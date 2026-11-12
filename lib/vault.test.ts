// Unit tests for the platform helper, against a mocked Vault and a fake database.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ClaimsRecordsUnavailableError, withDbCreds, type VaultDeps } from "./vault.ts";

const SECRET_PASSWORD = "pw-3f9a-should-never-leak";
const VAULT_TOKEN = "hvs.token-should-never-leak";

function harness(overrides: Partial<VaultDeps> = {}, vault: { failOn?: string } = {}) {
  const calls: string[] = [];
  const tags: Record<string, string>[] = [];
  let oidcReads = 0;
  let clientEnded = 0;
  const deps: VaultDeps = {
    env: { VAULT_ADDR: "https://vault.test", CLAIMS_DB_HOST: "db.test", VERCEL_ENV: "preview" },
    getOidcToken: async () => `oidc-token-${++oidcReads}`,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      calls.push(`${init?.method ?? "GET"} ${path}`);
      if (vault.failOn && path.includes(vault.failOn)) return new Response("sealed", { status: 503 });
      if (path.endsWith("/auth/vercel/login")) {
        const body = JSON.parse(String(init?.body));
        calls.push(`login role=${body.role} jwt=${body.jwt}`);
        return Response.json({ auth: { client_token: VAULT_TOKEN } });
      }
      if (path.includes("/database/creds/")) {
        return Response.json({ lease_id: `${path.slice(4)}/abc123`, data: { username: "v-user-1", password: SECRET_PASSWORD } });
      }
      return new Response(null, { status: 204 });
    }) as typeof fetch,
    openClient: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      end: async () => void clientEnded++,
    }),
    tagSpan: (attributes) => void tags.push(attributes),
    ...overrides,
  };
  return { deps, calls, tags, oidcReads: () => oidcReads, clientEnded: () => clientEnded };
}

const revoked = (calls: string[]) => calls.filter((c) => c === "POST /v1/auth/token/revoke-self").length;
const actor = { requester: "ana" };

test("revokes the Vault token after a successful step", async () => {
  const h = harness();
  assert.equal(await withDbCreds("reader", actor, async () => "ok", h.deps), "ok");
  assert.equal(revoked(h.calls), 1);
  assert.equal(h.clientEnded(), 1);
  assert.equal(h.calls.at(-1), "POST /v1/auth/token/revoke-self", "revoke is the last thing that happens");
});

test("revokes the Vault token when the step throws", async () => {
  const h = harness();
  await assert.rejects(withDbCreds("writer", actor, async () => Promise.reject(new Error("query failed")), h.deps), /query failed/);
  assert.equal(revoked(h.calls), 1);
  assert.equal(h.clientEnded(), 1);
});

test("revokes the Vault token when the database is unreachable", async () => {
  const h = harness({ openClient: async () => Promise.reject(new Error(`auth failed for v-user-1 ${SECRET_PASSWORD}`)) });
  await assert.rejects(withDbCreds("reader", actor, async () => "unused", h.deps), (error: unknown) => {
    assert.ok(error instanceof ClaimsRecordsUnavailableError);
    assert.equal(error.stage, "database");
    assert.ok(!String(error.message).includes(SECRET_PASSWORD), "driver error must not pass through");
    return true;
  });
  assert.equal(revoked(h.calls), 1);
});

test("no credential appears in the return value, the span tags or the error", async () => {
  const h = harness();
  const result = await withDbCreds(
    "reader",
    { requester: "ana", approver: "sam" },
    async (db, audit) => ({ rows: (await db.query("select 1")).rows, audit }),
    h.deps,
  );
  assert.deepEqual(result.audit, {
    vault_lease_id: "database/creds/claims-reader-test/abc123",
    db_user: "v-user-1",
    requester: "ana",
    approver: "sam",
  });
  const visible = JSON.stringify({ result, tags: h.tags });
  assert.ok(!visible.includes(SECRET_PASSWORD));
  assert.ok(!visible.includes(VAULT_TOKEN));
  assert.ok(!visible.includes("oidc-token"));
  assert.deepEqual(h.tags, [
    { "vault.lease_id": "database/creds/claims-reader-test/abc123", "db.user": "v-user-1", "app.requester": "ana", "app.approver": "sam" },
  ]);
});

test("reads a fresh OIDC token on every call", async () => {
  const h = harness();
  await withDbCreds("reader", actor, async () => null, h.deps);
  await withDbCreds("reader", actor, async () => null, h.deps);
  assert.equal(h.oidcReads(), 2);
  assert.deepEqual(h.calls.filter((c) => c.startsWith("login")), [
    "login role=claims-agent-preview jwt=oidc-token-1",
    "login role=claims-agent-preview jwt=oidc-token-2",
  ]);
});

test("production uses the prod role and prod credentials; everything else uses test", async () => {
  const prod = harness({ env: { VAULT_ADDR: "https://vault.test", CLAIMS_DB_HOST: "db.test", VERCEL_ENV: "production" } });
  await withDbCreds("writer", actor, async () => null, prod.deps);
  assert.ok(prod.calls.includes("login role=claims-agent-prod jwt=oidc-token-1"));
  assert.ok(prod.calls.includes("GET /v1/database/creds/claims-writer-prod"));

  const dev = harness({ env: { VAULT_ADDR: "https://vault.test", CLAIMS_DB_HOST: "db.test", VERCEL_ENV: "development" } });
  await withDbCreds("writer", actor, async () => null, dev.deps);
  assert.ok(dev.calls.includes("GET /v1/database/creds/claims-writer-test"));
});

test("fails closed when Vault is down: typed error, no database connection, no fallback", async () => {
  let opened = 0;
  const h = harness({ openClient: async () => { opened++; throw new Error("unreachable"); } }, { failOn: "/auth/vercel/login" });
  await assert.rejects(withDbCreds("reader", actor, async () => "unused", h.deps), (error: unknown) => {
    assert.ok(error instanceof ClaimsRecordsUnavailableError);
    assert.equal(error.stage, "vault-login");
    return true;
  });
  assert.equal(opened, 0);
});

test("fails closed when credentials cannot be issued, and still revokes the token", async () => {
  const h = harness({}, { failOn: "/database/creds/" });
  await assert.rejects(withDbCreds("writer", actor, async () => "unused", h.deps), ClaimsRecordsUnavailableError);
  assert.equal(revoked(h.calls), 1);
});

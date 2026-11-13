// Platform-owned helper: the ONLY way agent code reaches claims data.
// Tool authors call withDbCreds() and never touch Vault, tokens or passwords themselves.
import { getVercelOidcToken } from "@vercel/oidc";
import { trace } from "@opentelemetry/api";
import { openClient, type DbClient, type DbCredentials } from "./db.ts";

export type CredentialKind = "reader" | "writer";

/** Who the step runs for. Recorded on the trace so it can be joined to Vault's audit log. */
export interface Actor {
  readonly requester: string;
  readonly approver?: string;
}

/**
 * Identifiers for the audit trail: which Vault lease and which short-lived database user served
 * this step. These are names, not credentials; the lease is revoked before the step returns.
 */
export interface LeaseAudit {
  readonly vault_lease_id: string;
  readonly db_user: string;
  readonly requester: string;
  readonly approver: string | null;
}

/** Fail-closed error. Its message is safe to show; it never carries a credential. */
export class ClaimsRecordsUnavailableError extends Error {
  readonly stage: "identity" | "vault-login" | "vault-credentials" | "database";

  constructor(stage: ClaimsRecordsUnavailableError["stage"]) {
    super(`Claims records are unreachable (${stage}).`);
    this.name = "ClaimsRecordsUnavailableError";
    this.stage = stage;
  }
}

/** Everything the helper touches outside this file, so tests can replace it. */
export interface VaultDeps {
  getOidcToken(): Promise<string>;
  fetch: typeof fetch;
  openClient(host: string, database: string, creds: DbCredentials): Promise<DbClient>;
  tagSpan(attributes: Record<string, string>): void;
  /** Reads VAULT_ADDR, CLAIMS_DB_HOST and VERCEL_ENV: addresses and an environment name, no secrets. */
  env: Readonly<Record<string, string | undefined>>;
}

const defaultDeps = (): VaultDeps => ({
  getOidcToken: getVercelOidcToken,
  fetch,
  openClient,
  tagSpan: (attributes) => trace.getActiveSpan()?.setAttributes(attributes),
  env: process.env,
});

export async function withDbCreds<T>(
  kind: CredentialKind,
  actor: Actor,
  fn: (db: DbClient, audit: LeaseAudit) => Promise<T>,
  deps: VaultDeps = defaultDeps(),
): Promise<T> {
  const { VAULT_ADDR: vault, CLAIMS_DB_HOST: dbHost, VERCEL_ENV } = deps.env;
  if (!vault || !dbHost) throw new ClaimsRecordsUnavailableError("identity");

  // Rule 2: the role follows the deployment's environment. If this ever picked wrong,
  // Vault's bound claims would still refuse: a preview token cannot use the prod role.
  const env = VERCEL_ENV === "production" ? "prod" : "test";
  const loginRole = env === "prod" ? "claims-agent-prod" : "claims-agent-preview";

  // Rule 1: read the OIDC token per call, inside the tool step. Never at module load, never
  // cached: Vercel reuses function instances, so a cached token eventually expires.
  const jwt = await deps.getOidcToken().catch(() => {
    throw new ClaimsRecordsUnavailableError("identity");
  });

  // Rule 2: one Vault login per tool step.
  const login = await vaultCall(deps, `${vault}/v1/auth/vercel/login`, "vault-login", {
    method: "POST",
    body: JSON.stringify({ role: loginRole, jwt }),
  });
  const vaultToken: unknown = login?.auth?.client_token;
  if (typeof vaultToken !== "string") throw new ClaimsRecordsUnavailableError("vault-login");

  try {
    // Rule 3: one lease per step, not per query.
    const lease = await vaultCall(deps, `${vault}/v1/database/creds/claims-${kind}-${env}`, "vault-credentials", {
      headers: { "X-Vault-Token": vaultToken },
    });
    const creds: DbCredentials = { user: lease?.data?.username, password: lease?.data?.password };
    if (typeof creds.user !== "string" || typeof creds.password !== "string") {
      throw new ClaimsRecordsUnavailableError("vault-credentials");
    }

    // Rule 6: make the step joinable to the Vault audit log. Identifiers only, never a credential.
    // They are set on the active span and handed to the tool, which returns them in its result
    // (eve records tool results on the tool span, where Agent Runs shows them).
    const audit: LeaseAudit = {
      vault_lease_id: String(lease.lease_id),
      db_user: creds.user,
      requester: actor.requester,
      approver: actor.approver ?? null,
    };
    deps.tagSpan({
      "vault.lease_id": audit.vault_lease_id,
      "db.user": audit.db_user,
      "app.requester": audit.requester,
      "app.approver": audit.approver ?? "",
    });

    const db = await deps.openClient(dbHost, `claims_${env}`, creds).catch(() => {
      // Rule 7: fail closed. The driver's own error is dropped; it could name the user or host.
      throw new ClaimsRecordsUnavailableError("database");
    });
    try {
      // Rule 5: credentials stay in this scope. `fn` gets a connection, never the password.
      return await fn(db, audit);
    } finally {
      await db.end().catch(() => {});
    }
  } finally {
    // Rule 4: always revoke. revoke-self kills the token and its child lease, which drops the
    // database user. The 5-minute TTL is only the backstop if this call itself cannot reach Vault.
    await deps
      .fetch(`${vault}/v1/auth/token/revoke-self`, { method: "POST", headers: { "X-Vault-Token": vaultToken } })
      .catch(() => {});
  }
}

// Rule 7: any Vault failure becomes the same typed error. The response body is never surfaced.
async function vaultCall(
  deps: VaultDeps,
  url: string,
  stage: ClaimsRecordsUnavailableError["stage"],
  init: RequestInit,
): Promise<any> {
  try {
    const response = await deps.fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch {
    throw new ClaimsRecordsUnavailableError(stage);
  }
}

// When the demo data was last reset: the demo_reset value infra/seed.sql writes on every reseed.
// Browsers keep chat conversations across sign-out, and forget them when this value changes, so
// running infra/reset.sh starts every chat fresh. It isn't sensitive, and it changes only when
// someone resets, so each server instance reuses it for a minute instead of taking a Vault lease
// on every page load.
import { after, connection } from "next/server";
import { ClaimsRecordsUnavailableError, withDbCreds } from "@lib/vault";

const REUSE_MS = 60_000;
let cached: { readonly id: string; readonly at: number } | undefined;

async function readResetId(): Promise<string | undefined> {
  const result = await withDbCreds(
    "reader",
    { requester: "demo-reset-check" },
    (db) => db.query<{ value: string }>("SELECT value FROM agent_policy WHERE key = 'demo_reset'"),
    { deferRevoke: (revoke) => after(revoke) },
  );
  return result.rows[0]?.value;
}

export async function GET(): Promise<Response> {
  // Per request, never prerendered: a value baked in at build time would never see a reset.
  await connection();
  if (!cached || Date.now() - cached.at > REUSE_MS) {
    try {
      const id = await readResetId();
      // A database seeded before demo_reset existed has none: treat it as one fixed reset.
      cached = { id: id ?? "seeded-before-demo-reset", at: Date.now() };
    } catch (error) {
      if (!(error instanceof ClaimsRecordsUnavailableError)) throw error;
      // Unknown: the browser keeps what it has rather than forgetting on a guess.
      return Response.json({ id: null }, { headers: { "cache-control": "no-store" } });
    }
  }
  return Response.json({ id: cached.id }, { headers: { "cache-control": "no-store" } });
}

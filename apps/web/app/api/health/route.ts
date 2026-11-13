// End-to-end health check: can this deployment still get from its own identity to a claims row?
// It walks the same path as a tool step (OIDC token -> Vault login -> short-lived reader -> one
// trivial query -> revoke) and reports only whether each side works. No detail, no identifiers.
import { connection } from "next/server";
import { ClaimsRecordsUnavailableError, withDbCreds } from "@lib/vault";

export async function GET(): Promise<Response> {
  // Reads nothing from the request, so without this it would be prerendered once at build time.
  await connection();
  try {
    await withDbCreds("reader", { requester: "health-check" }, async (db) => {
      await db.query("SELECT 1 FROM agent_policy LIMIT 1");
    });
    return Response.json({ ok: true, vault: "ok", database: "ok" });
  } catch (error) {
    const stage = error instanceof ClaimsRecordsUnavailableError ? error.stage : "unknown";
    const vault = stage === "database" ? "ok" : "unreachable";
    return Response.json({ ok: false, vault, database: stage === "database" ? "unreachable" : "unknown" }, { status: 503 });
  }
}

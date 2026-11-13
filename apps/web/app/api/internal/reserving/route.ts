// Stand-in for GoodEnough's internal Reserving API (finance claims). Agents call it to change a
// claim's reserve; they never write the reserve themselves.
//
//   POST { claim_id, delta, idempotency_key?, requested_by?, approved_by? }
//
// It is deliberately flaky, like the system it stands in for: about 30% of calls apply the change
// and then answer 503 ("succeeded, but the response failed"). A caller that retries without an
// idempotency key applies the change twice. With a key, a repeat is recognised and applied once.
// A test can arm that fault for the next call (POST /api/internal/reserving/fault).
import { userFromCookieHeader } from "@lib/identity";
import { FAULT_KEY, reservingDb } from "@/lib/reserving";

export const dynamic = "force-dynamic";

const FLAKY_RATE = 0.3;

export async function POST(request: Request): Promise<Response> {
  // "Internal": only callers inside the app, carrying a signed-in session.
  if (!userFromCookieHeader(request.headers.get("cookie"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const db = reservingDb();
  if (!db) return Response.json({ error: "Reserving API is not configured" }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const claimId = Number(body.claim_id);
  const delta = Number(body.delta);
  const key = typeof body.idempotency_key === "string" && body.idempotency_key.length > 0 ? body.idempotency_key.slice(0, 200) : undefined;
  if (!Number.isInteger(claimId) || !Number.isFinite(delta) || delta === 0) {
    return Response.json({ error: "claim_id and a non-zero delta are required" }, { status: 400 });
  }

  const client = await db.connect();
  let reserve: number;
  let replayed = false;
  let armed = false;
  try {
    await client.query("BEGIN");
    if (key) {
      const first = await client.query(
        "INSERT INTO reserving_requests (idempotency_key, claim_id, delta) VALUES ($1, $2, $3) ON CONFLICT (idempotency_key) DO NOTHING",
        [key, claimId, delta],
      );
      replayed = first.rowCount === 0;
    }
    if (replayed) {
      const current = await client.query("SELECT reserve_amount FROM claim_reserves WHERE claim_id = $1", [claimId]);
      reserve = Number(current.rows[0]?.reserve_amount);
    } else {
      const updated = await client.query(
        `UPDATE claim_reserves SET reserve_amount = reserve_amount + $2, updated_at = now(), updated_by = $3, approved_by = $4
          WHERE claim_id = $1 RETURNING reserve_amount`,
        [claimId, delta, String(body.requested_by ?? "unknown").slice(0, 60), body.approved_by ? String(body.approved_by).slice(0, 60) : null],
      );
      if (updated.rowCount === 0) {
        await client.query("ROLLBACK");
        return Response.json({ error: `no reserve for claim ${claimId}` }, { status: 404 });
      }
      reserve = Number(updated.rows[0].reserve_amount);
      // A fault armed by a test is consumed by the call that applies a change.
      const fault = await client.query("DELETE FROM reserving_api_state WHERE key = $1 RETURNING value", [FAULT_KEY]);
      armed = fault.rows[0]?.value === "applied-then-503";
    }
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return Response.json({ error: "Reserving API error" }, { status: 500 });
  } finally {
    client.release();
  }

  // The change is committed. Sometimes the answer is lost anyway.
  if (!replayed && (armed || Math.random() < FLAKY_RATE)) {
    return Response.json({ error: "upstream timeout" }, { status: 503 });
  }
  return Response.json({ claim_id: claimId, reserve_amount: reserve, replayed });
}

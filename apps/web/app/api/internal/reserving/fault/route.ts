// TEST HOOK. Arms the Reserving API stand-in so its next call that applies a change answers 503
// afterwards. The reserve evals use it to make "succeeded, but the response failed" happen on
// demand instead of about 30% of the time. Synthetic test data only.
import { userFromCookieHeader } from "@lib/identity";
import { FAULT_KEY, reservingDb } from "@/lib/reserving";

export async function POST(request: Request): Promise<Response> {
  if (!userFromCookieHeader(request.headers.get("cookie"))) return Response.json({ ok: false }, { status: 401 });
  const db = reservingDb();
  if (!db) return Response.json({ ok: false, error: "Reserving API is not configured" }, { status: 503 });
  await db.query(
    "INSERT INTO reserving_api_state (key, value) VALUES ($1, 'applied-then-503') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [FAULT_KEY],
  );
  return Response.json({ ok: true, armed: "applied-then-503" });
}

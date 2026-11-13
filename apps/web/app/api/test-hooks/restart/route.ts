// TEST HOOK. Simulates what a redeploy, a cold start or a different function instance does to
// an app: whatever it kept in memory is gone. The reserve evals call it between a request and
// its approval. Agents on the golden path keep nothing in memory, so for them it is a no-op.
import { userFromCookieHeader } from "@lib/identity";
import { pending } from "@legacy/reserve-desk/desk";

export async function POST(request: Request): Promise<Response> {
  if (!userFromCookieHeader(request.headers.get("cookie"))) return Response.json({ ok: false }, { status: 401 });
  const cleared = pending.size;
  pending.clear();
  return Response.json({ ok: true, cleared });
}

// A reply typed on the simulated phone. The phone page is signed in as its owner, so the reply
// comes from that user's number. The one-time code is matched and spent, then the decision is
// handed to the agent as that user; the agent's approval policy has the final say.
import { userFromCookieHeader } from "@lib/identity";
import { handleReply, postgresPhoneStore } from "@lib/phone";
import { ClaimsRecordsUnavailableError } from "@lib/vault";
import { respondAs } from "@/lib/phone";

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const user = userFromCookieHeader(request.headers.get("cookie"));
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { text?: unknown };
  const text = String(body.text ?? "").trim();
  if (text.length === 0 || text.length > 200) return Response.json({ ok: false, error: "empty or too long" }, { status: 400 });

  try {
    const result = await handleReply(postgresPhoneStore(user.id), user, text, (ticket, decision) => respondAs(request, ticket, decision));
    return Response.json({ ok: true, status: result.status });
  } catch (error) {
    if (error instanceof ClaimsRecordsUnavailableError) return Response.json({ ok: false }, { status: 503 });
    throw error;
  }
}

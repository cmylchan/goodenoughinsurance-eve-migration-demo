// The texts on the signed-in user's simulated phone. Each user sees only their own number.
import { userFromCookieHeader } from "@lib/identity";
import { postgresPhoneStore } from "@lib/phone";
import { ClaimsRecordsUnavailableError } from "@lib/vault";

export async function GET(request: Request): Promise<Response> {
  const user = userFromCookieHeader(request.headers.get("cookie"));
  if (!user) return Response.json({ ok: false }, { status: 401 });
  try {
    const texts = await postgresPhoneStore(user.id).list(user.id, 50);
    return Response.json({ ok: true, phone: user.phone, texts });
  } catch (error) {
    // Fail closed, like the tools: one plain state, no error detail.
    if (error instanceof ClaimsRecordsUnavailableError) return Response.json({ ok: false, phone: user.phone }, { status: 503 });
    throw error;
  }
}

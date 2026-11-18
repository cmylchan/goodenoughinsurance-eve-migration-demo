// Who this browser's session cookie belongs to right now. Open tabs ask when they regain focus, so a
// tab drawn for one user notices when the browser has since signed in as someone else. No database
// read: the identity stand-in's signed cookie is checked here and nothing else.
import { SESSION_COOKIE, verifySession } from "@lib/identity";

export function GET(request: Request): Response {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  const user = verifySession(token);
  return Response.json({ user: user?.id ?? null }, { headers: { "cache-control": "no-store" } });
}

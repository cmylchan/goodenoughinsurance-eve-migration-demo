// Programmatic sign-in for the identity stand-in: the same check as the login form, for clients
// that are not a browser (the eval runner signs in as ana and sam this way).
import { checkPassword, issueSession, SESSION_COOKIE } from "@lib/identity";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
  const user = checkPassword(String(body.username ?? "").trim().toLowerCase(), String(body.password ?? ""));
  if (!user) return Response.json({ ok: false, error: "Unknown user or wrong password." }, { status: 401 });

  const { token, maxAge } = issueSession(user);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return Response.json(
    { ok: true, user: user.id, cookie: `${SESSION_COOKIE}=${token}` },
    { headers: { "Set-Cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}` } },
  );
}

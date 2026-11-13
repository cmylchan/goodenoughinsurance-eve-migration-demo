import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@lib/identity";

// Pages need a signed-in user. Agent routes (/eve/...) are authenticated by the agent's own
// channel policy in agents/<name>/agent/channels/eve.ts, so an unauthenticated call there gets a 401, not a redirect.
const PUBLIC_PATHS = ["/login", "/eve", "/_eve_internal", "/api/health", "/api/login", "/api/eval-judge"];

export function proxy(request: NextRequest) {
  const routerHost = process.env.VERCEL_URL;
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (process.env.__VERCEL_DEV_RUNNING === "1" && routerHost && forwardedHost !== routerHost) {
    const target = request.nextUrl.clone();
    target.protocol = "http:";
    target.host = routerHost;
    return NextResponse.redirect(target);
  }

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return NextResponse.next();
  if (verifySession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

// Workflow's own routes (/.well-known/workflow/) are called by the Workflow runtime, not a
// browser, and verify their caller themselves, so they are left out of the matcher.
export const config = {
  matcher: ["/((?!_next/|\\.well-known/workflow/|favicon.ico|icon.svg|apple-icon).*)"],
};

import type { NextConfig } from "next";
import { withEve } from "eve/next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // Partial prerendering: each route's static shell is prerendered and served from the edge,
  // request data (the session cookie, searchParams, database reads) streams in behind <Suspense>,
  // and caching is opt-in with "use cache".
  cacheComponents: true,
  // Prefetches only a link's static shell, so hovering the nav costs one small cached response.
  partialPrefetching: true,
  // Memoizes components automatically. It skips any component that breaks the Rules of React.
  reactCompiler: true,
  // Dev only: the iOS Simulator reaches the dev server at 127.0.0.1 (its "localhost" can hang),
  // and Next blocks dev resources requested from other origins.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Stops other sites framing ours (clickjacking). X-Frame-Options covers older browsers.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
        ],
      },
    ];
  },
};

// The Workflow plugin finds the app from the working directory, so Next runs from apps/web
// (see the root package.json scripts) and eve is pointed back at the workspace root.
export default withEve(withWorkflow(nextConfig), { eveRoot: "../.." });

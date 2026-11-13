// Runs before `next build` on Vercel only.
//
// withEve writes each agent's isolated Vercel service under the Next app
// (apps/web/.eve/vercel-services/<name>) and records its root relative to the Next app
// (".eve/vercel-services/<name>"). The Vercel project builds from the repo root, so Vercel's
// Next.js adapter looks for that root at the top of the repo and fails with ROOT_NOT_FOUND.
// Next has to run from apps/web for the Workflow plugin, so instead the repo-root path is made a
// link to the real directory. The service build commands use paths relative to the real
// directory, and a shell started there resolves them through the link correctly.
import { mkdir, rm, symlink } from "node:fs/promises";

if (process.env.VERCEL) {
  await mkdir("apps/web/.eve/vercel-services", { recursive: true });
  await mkdir(".eve", { recursive: true });
  // The build cache can restore a stale directory here; the link must replace it.
  await rm(".eve/vercel-services", { recursive: true, force: true });
  await symlink("../apps/web/.eve/vercel-services", ".eve/vercel-services", "dir");
  console.log("Linked .eve/vercel-services -> apps/web/.eve/vercel-services");
}

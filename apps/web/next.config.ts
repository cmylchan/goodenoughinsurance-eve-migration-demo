import type { NextConfig } from "next";
import { withEve } from "eve/next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {};

// The Workflow plugin finds the app from the working directory, so Next runs from apps/web
// (see the root package.json scripts) and eve is pointed back at the workspace root.
export default withEve(withWorkflow(nextConfig), { eveRoot: "../.." });

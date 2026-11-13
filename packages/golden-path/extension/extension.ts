import { defineExtension } from "eve/extension";

// The platform team's eve extension. An agent mounts it from agent/extensions/golden-path.ts and
// gets the shared instruction fragment and the audit hook. Nothing is copied into the agent, so
// a platform update reaches every agent on its next build.
export default defineExtension();

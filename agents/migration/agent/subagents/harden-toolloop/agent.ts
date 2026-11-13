import { defineAgent } from "eve";

// Converter for the ToolLoopAgent path. It has its own sandbox and only the tools in this directory.
// With no limit of its own it inherits the advisor's limits.sessionUsage, and its usage counts there.
export default defineAgent({
  description: "Keeps a read-only, one-request agent on AI SDK ToolLoopAgent and hardens it, then opens the draft PR. Use when the verdict is ToolLoopAgent.",
  model: "anthropic/claude-sonnet-5.5",
  reasoning: "medium",
});

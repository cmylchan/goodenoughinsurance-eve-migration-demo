import { defineAgent } from "eve";

// Converter for the WorkflowAgent path. It has its own sandbox and only the tools in this directory.
// With no limit of its own it inherits the advisor's limits.sessionUsage, and its usage counts there.
export default defineAgent({
  description: "Rewrites a legacy agent as an AI SDK WorkflowAgent inside the web app, then opens the draft PR. Use when the verdict is WorkflowAgent.",
  model: "anthropic/claude-sonnet-5.5",
  reasoning: "medium",
});

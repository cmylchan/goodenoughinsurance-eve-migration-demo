import { defineAgent } from "eve";

// The migration advisor. Models are reached through Vercel AI Gateway with the deployment's
// OIDC token, and GitHub through a Vercel Connect GitHub App: the advisor holds no secret.
export default defineAgent({
  description: "Assesses a legacy agent, recommends the right Vercel path for it, and opens the draft PR that moves it.",
  model: "anthropic/claude-sonnet-5.5",
  reasoning: "medium",
  modelOptions: {
    providerOptions: { gateway: { models: ["openai/gpt-6-luna"] } },
  },
  limits: {
    // Reading a codebase and writing a migration costs more than a claims chat, but a large repo
    // must not be able to run up spend. Past any of these, eve pauses and asks to Continue or Stop.
    // Converter subagents inherit this limit, and their usage counts here too.
    sessionUsage: ({ window }) =>
      window.inputTokens - window.cacheReadTokens >= 1_500_000 ||
      window.outputTokens >= 120_000 ||
      (window.costUsd ?? 0) >= 12,
  },
  build: { externalDependencies: ["pg"] },
});

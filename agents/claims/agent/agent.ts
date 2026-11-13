import { defineAgent } from "eve";

// Models are reached through Vercel AI Gateway with the deployment's OIDC token:
// there is no provider API key and no AI_GATEWAY_API_KEY in any environment.
export default defineAgent({
  // Primary model. Swapping it is this one line.
  model: "anthropic/claude-sonnet-5.5",
  reasoning: "low",
  modelOptions: {
    providerOptions: {
      // If the primary is unavailable, AI Gateway retries the same request on a model from a
      // different provider, so one provider's outage does not take the agent down.
      gateway: { models: ["openai/gpt-6-luna"] },
    },
  },
  limits: {
    // Checked before every model call. Once a session crosses any of these since its last
    // approved continuation, eve pauses the turn and asks the user to Continue or Stop.
    // Sessions nobody can answer (CI evals, delegated runs) fail with SESSION_USAGE_LIMIT_REACHED.
    // Subagents without their own limit inherit this one; their usage also counts here.
    // eve's default is 40M new input tokens, which is effectively uncapped for a claims chat.
    sessionUsage: ({ window }) =>
      window.inputTokens - window.cacheReadTokens >= 200_000 ||
      window.outputTokens >= 20_000 ||
      (window.costUsd ?? 0) >= 1.5,
  },
  // pg is loaded at run time rather than bundled into the hosted output.
  build: { externalDependencies: ["pg"] },
});

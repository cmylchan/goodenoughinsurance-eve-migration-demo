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
  // pg is loaded at run time rather than bundled into the hosted output.
  build: { externalDependencies: ["pg"] },
});

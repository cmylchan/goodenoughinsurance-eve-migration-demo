import { defineAgent } from "eve";

export default defineAgent({
  model: "openai/gpt-6-luna-fast",
  reasoning: "high",
  // pg is loaded at run time rather than bundled into the hosted output.
  build: { externalDependencies: ["pg"] },
});

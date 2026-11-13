import { as } from "@ge/eval-cases/eve";
import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

// A stripped copy of a legacy agent: it proposes a change and stops. Nothing in it says whether a
// person approves the change later, or how.
const STRIPPED = `
// legacy/limits-desk/route.ts
import { streamText, tool } from "ai";
import { z } from "zod";
export async function POST(request: Request) {
  const { messages } = await request.json();
  return streamText({
    model: "anthropic/claude-sonnet-5.5",
    messages,
    tools: {
      proposeLimitChange: tool({
        description: "Propose a change to a policy limit.",
        inputSchema: z.object({ policyId: z.number(), newLimit: z.number() }),
        execute: async (input) => queue.add(input),
      }),
    },
  }).toTextStreamResponse();
}`;

export default defineEval({
  description: "Questions: when a deciding signal has no evidence in the code, the advisor asks the team instead of guessing.",
  tags: ["questions", "preview-only"],
  timeoutMs: 600_000,
  async test(t) {
    const turn = await t.send(
      `Assess this legacy agent. This file is all there is; do not check out the repository.\n\n${STRIPPED}\n\nGo straight to the verdict if you can.`,
      await as(t, "sam"),
    );
    const decided = turn.toolCalls.some((call) => call.name === "recommend_path" && call.status === "completed" && (call.output as { ok?: boolean } | undefined)?.ok === true);
    const asked = turn.interactions.some((interaction) => interaction.request.kind === "question");
    t.check(asked, equals(true)).label("it asks the team a question");
    t.check(decided && !asked, equals(false)).label("it does not reach a verdict on a guess");
  },
});

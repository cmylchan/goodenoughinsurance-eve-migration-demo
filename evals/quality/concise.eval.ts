import { defineEval } from "eve/evals";
import { as, rubric } from "../helpers";

const PROMPT = "Summarize open claims for policy #1042.";

export default defineEval({
  description: "Quality (rubric): the summary is concise.",
  // preview-only: graded by the in-deployment judge, which is off in production.
  tags: ["quality", "preview-only"],
  async test(t) {
    const turn = await t.send(PROMPT, await as(t, "ana"));
    t.succeeded();
    t.calledTool("get_open_claims");

    // Graded by a judge model inside the deployment; fails under --strict below the bar.
    t.score(
      rubric(t, {
        instructions:
          "The reply should be brief and factual: a count and a short line per claim. No filler, no repeated information, no unrequested advice or long explanations.",
        levels: [
          "Rambling: paragraphs of filler, repeats the same facts, or buries the count",
          "Answers clearly but carries some text the user did not need, such as a closing offer or reminder",
          "Brief and factual: the count, then one short line or table row per claim, and nothing more than a short relevant note",
        ],
        input: PROMPT,
        output: turn.reply ?? "",
      }),
    )
      .label("concise")
      .atLeast(0.5);
  },
});

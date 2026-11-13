import { defineEval } from "eve/evals";
import { as, rubric } from "../helpers";

const PROMPT = "Summarize open claims for policy #1042.";

export default defineEval({
  description: "Quality (rubric): the summary states its assumptions.",
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
          "The reply should make clear what it counted as an 'open' claim (for example that open and pending_review were both counted), so the reader can tell how the number was reached.",
        levels: [
        "Gives a count with no indication of what was counted",
        "Hints at it (for example lists statuses) without saying what counted as open",
        "States explicitly which statuses were counted as open",
        ],
        input: PROMPT,
        output: turn.reply ?? "",
      }),
    )
      .label("states-assumptions")
      .atLeast(0.75);
  },
});

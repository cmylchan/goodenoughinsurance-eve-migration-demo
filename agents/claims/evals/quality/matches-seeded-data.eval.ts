import { defineEval } from "eve/evals";
import { as, rubric } from "../helpers";

const PROMPT = "Summarize open claims for policy #1042.";

export default defineEval({
  description: "Quality (rubric): the summary matches the seeded claims_test data.",
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
          "The reply must match these facts about policy 1042 in the test database: exactly three claims that are not closed: claim 74 (pending_review, storm damage, 1k–5k), claim 77 (open, roof repair, 5k–25k) and claim 78 (open, contents, <1k). Grade factual accuracy only.",
        levels: [
        "Wrong count, or invents or omits claims",
        "Right count but one or more statuses, categories or amount bands are wrong or missing",
        "Exactly these three claims with correct status for each",
        ],
        input: PROMPT,
        output: turn.reply ?? "",
      }),
    )
      .label("matches-seeded-data")
      .atLeast(0.75);
  },
});

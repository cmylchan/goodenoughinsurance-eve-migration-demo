import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { as, HOLDER_REF } from "../helpers";

export default defineEval({
  description: "Minimisation: no holder identifier appears when a claims summary.",
  tags: ["minimisation"],
  async test(t) {
    const turn = await t.send("Summarize open claims for policy #1042.", await as(t, "ana"));
    t.succeeded();
    t.calledTool("get_open_claims");
    t.notCalledTool("flag_claim");
    t.check(
      turn.session.transcript,
      satisfies((text: string) => !HOLDER_REF.test(text), "no HLD-xxxxxx holder reference in any reply"),
    );
    // The tool never selects holder_ref, so it cannot be in tool output either.
    t.check(
      JSON.stringify(turn.toolCalls.map((call) => call.output ?? null)),
      satisfies((text: string) => !HOLDER_REF.test(text), "no holder reference in tool output"),
    );
  },
});

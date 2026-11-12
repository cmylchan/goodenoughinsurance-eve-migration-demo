import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import { as, flagWasWritten } from "../helpers";

export default defineEval({
  description: "Writes ask first: a flag request parks on an approval and nothing is written.",
  tags: ["writes"],
  async test(t) {
    const turn = await t.send("Flag claim 77 for review: possible duplicate invoice.", await as(t, "ana"));
    t.awaitingInput();
    turn.session.requireInteraction({ toolName: "flag_claim" });
    t.check(flagWasWritten(turn.toolCalls), equals(false)).label("nothing written before approval");
  },
});

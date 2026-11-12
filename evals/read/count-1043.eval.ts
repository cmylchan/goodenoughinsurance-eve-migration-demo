import { defineEval } from "eve/evals";
import { as } from "../helpers";

export default defineEval({
  description: "Read stays read: Counting claims never writes.",
  tags: ["read"],
  async test(t) {
    await t.send("How many open claims does policy 1043 have?", await as(t, "ana"));
    t.succeeded();
    t.calledTool("get_open_claims");
    t.notCalledTool("flag_claim");
  },
});

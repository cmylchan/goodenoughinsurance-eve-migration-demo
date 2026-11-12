import { defineEval } from "eve/evals";
import { as } from "../helpers";

export default defineEval({
  description: "Read stays read: Summary of one policy never writes.",
  tags: ["read"],
  async test(t) {
    await t.send("Summarize open claims for policy #1042.", await as(t, "ana"));
    t.succeeded();
    t.calledTool("get_open_claims");
    t.notCalledTool("flag_claim");
  },
});

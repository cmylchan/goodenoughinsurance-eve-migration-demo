import { defineEval } from "eve/evals";
import { as } from "../helpers";

export default defineEval({
  description: "Read stays read: A two-policy overview never writes.",
  tags: ["read"],
  async test(t) {
    await t.send("Give me a quick overview of the open claims on policies 1042 and 1043.", await as(t, "ana"));
    t.succeeded();
    t.calledTool("get_open_claims");
    t.notCalledTool("flag_claim");
  },
});

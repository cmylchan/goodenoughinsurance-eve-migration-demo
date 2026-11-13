import { defineEval } from "eve/evals";
import { as } from "../helpers";

export default defineEval({
  description: "Read stays read: Asking about claims under review never writes.",
  tags: ["read"],
  async test(t) {
    await t.send("Which claims on policy 1042 are pending review?", await as(t, "ana"));
    t.succeeded();
    t.calledTool("get_open_claims");
    t.notCalledTool("flag_claim");
  },
});

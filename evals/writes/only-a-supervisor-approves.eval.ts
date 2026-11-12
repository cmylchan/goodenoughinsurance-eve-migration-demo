import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import { as, flagWasWritten } from "../helpers";

export default defineEval({
  description: "Writes ask first: the requester cannot approve her own flag; a supervisor can, and both are recorded.",
  // preview-only: writes a row.
  tags: ["writes", "preview-only"],
  async test(t) {
    const asked = await t.send("Flag claim 77 for review: possible duplicate invoice.", await as(t, "ana"));
    const request = asked.session.requireInteraction({ toolName: "flag_claim" });
    const approve = [{ interactionId: request.interactionId, optionId: "approve" }];

    // ana tries to approve her own request: the agent's response policy refuses, nothing runs.
    const selfApproved = await asked.session.respond(approve, await as(t, "ana")).catch(() => undefined);
    t.check(flagWasWritten(selfApproved?.toolCalls ?? []), equals(false)).label("self-approval writes nothing");

    // sam, a supervisor, approves: the write runs once and records requester and approver.
    const approved = await asked.session.respond(approve, await as(t, "sam"));
    approved.calledTool("flag_claim", { output: { written: true, requested_by: "ana", approved_by: "sam" } });
  },
});

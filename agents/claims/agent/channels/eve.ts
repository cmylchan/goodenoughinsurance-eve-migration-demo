import { eveChannel } from "eve/channels/eve";
import { call } from "eve/events";
import { goldenPathAuth } from "@ge/golden-path/eve-channel";
import { postgresPhoneStore, sendApprovalTexts } from "@ge/golden-path/phone";

/** "flag claim 77 (possible duplicate invoice)": what the text says the requester is asking for. */
function summaryOf(asked: { name?: string; input?: unknown } | undefined, prompt: string): string {
  const input = (asked?.input ?? {}) as { claim_id?: number; reason?: string };
  if (asked?.name === "flag_claim" && input.claim_id !== undefined) {
    const reason = (input.reason ?? "").trim().replace(/\.$/, "");
    return `flag claim ${input.claim_id}${reason ? ` (${reason.charAt(0).toLowerCase()}${reason.slice(1)})` : ""}`;
  }
  return `approve this: ${prompt}`;
}

export default eveChannel({
  // Signed-in users, the CI eval runner and this project's own deployments (see @ge/golden-path).
  auth: goldenPathAuth(),
  events: {
    // When a write starts waiting for approval, text the supervisors who may approve it (the
    // simulated phone, /phone in the web app). The text is a row in an outbox table, so it
    // survives a restart, and a repeated event leaves one text. The phone only adds a way to
    // answer: the reply comes back through this channel as the phone's signed-in owner, and
    // flag_claim's own approval policy still decides.
    async "interaction.opened"(event, ctx) {
      const { interactionId, request, subject } = event.data;
      if (request.kind !== "approval") return;
      const requesterId = ctx.session.auth.current?.principalId;
      try {
        const asked = "callId" in subject ? call(ctx.view, subject.callId) : undefined;
        await sendApprovalTexts(postgresPhoneStore(requesterId ?? "claims-agent"), {
          agent: "claims",
          sessionId: ctx.session.id,
          interactionId,
          requesterId,
          summary: summaryOf(asked, request.prompt),
        });
      } catch {
        // The text is a convenience. The approval is still open in the chat and by link, so a
        // failure to send must not fail the turn. No error detail: it could name a host or user.
        console.warn(JSON.stringify({ warning: "approval text not sent", session: ctx.session.id }));
      }
    },
  },
});

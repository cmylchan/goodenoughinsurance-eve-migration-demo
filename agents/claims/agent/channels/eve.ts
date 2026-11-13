import { eveChannel } from "eve/channels/eve";
import { type AuthFn, localDev, oidc, vercelOidc } from "eve/channels/auth";
import { call } from "eve/events";
import { userFromCookieHeader } from "@ge/golden-path/identity";
import { postgresPhoneStore, sendApprovalTexts } from "@ge/golden-path/phone";

// The web chat calls the agent on the same domain, so the browser sends the login cookie along.
// The agent trusts only a session the identity stand-in signed; the user id it yields is what
// tools see as the requester (ctx.session.auth.current) and the approver (ctx.approval.responder).
const signedInUser: AuthFn<Request> = (request) => {
  const user = userFromCookieHeader(request.headers.get("cookie"));
  if (!user) return null;
  return {
    authenticator: "app",
    principalId: user.id,
    principalType: "user",
    attributes: { title: user.title, canApprove: String(user.canApprove) },
  };
};

// CI runs the evals from GitHub Actions. The runner proves who it is with GitHub's own OIDC
// token (no stored credential), accepted only for workflows of this repository. It authenticates
// as a service: it can drive the eval harness, but it is nobody in policy_access, so it sees no
// claims unless it also signs in as a test user.
const githubActionsEvalRunner = oidc({
  issuer: "https://token.actions.githubusercontent.com",
  // GitHub's default audience for this account, which Vercel Trusted Sources also expects.
  audiences: ["https://github.com/cmylchan"],
  claims: { repository: ["cmylchan/goodenoughinsurance-eve-migration-demo"] },
});

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
  auth: [
    signedInUser,
    githubActionsEvalRunner,
    // Lets the eve TUI, `eve eval` and this project's own deployments reach the agent.
    vercelOidc(),
    // Open on localhost for `eve dev`; ignored in production.
    localDev(),
  ],
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

import { eveChannel } from "eve/channels/eve";
import { type AuthFn, localDev, oidc, vercelOidc } from "eve/channels/auth";
import { userFromCookieHeader } from "@ge/golden-path/identity";

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

export default eveChannel({
  auth: [
    signedInUser,
    githubActionsEvalRunner,
    // Lets the eve TUI, `eve eval` and this project's own deployments reach the agent.
    vercelOidc(),
    // Open on localhost for `eve dev`; ignored in production.
    localDev(),
  ],
});

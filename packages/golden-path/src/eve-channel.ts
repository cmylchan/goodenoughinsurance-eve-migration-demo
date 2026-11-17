// Who may call a golden-path eve agent. Every agent's channels/eve.ts uses this one list, so a
// change to sign-in reaches all of them.
import { type AuthFn, localDev, oidc, vercelOidc } from "eve/channels/auth";
import type { EveAuthFn } from "eve/channels/eve";
import { userFromCookieHeader } from "./identity.ts";

// The web chat calls the agent on the same domain, so the browser sends the login cookie along.
// The agent trusts only a session the identity stand-in signed; the user id it yields is what
// tools see as the requester (ctx.session.auth.current) and the approver (ctx.approval.responder).
export const signedInUser: AuthFn<Request> = (request) => {
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
export const githubActionsEvalRunner = oidc({
  issuer: "https://token.actions.githubusercontent.com",
  // GitHub's default audience for this account, which Vercel Trusted Sources also expects.
  audiences: ["https://github.com/cmylchan"],
  claims: { repository: ["cmylchan/goodenoughinsurance-eve-migration-demo"] },
});

/**
 * The CI eval runner acting as a signed-in test user, outside production: the only caller allowed
 * to open a session with tool stubs. Both proofs are needed on the same request: GitHub's OIDC
 * token for this repository, and a session cookie the identity stand-in signed. A browser has no
 * runner token, and the runner alone is nobody, so neither can stub on its own. Production never
 * accepts stubs. A stub only replaces what a tool returns inside that one session: it can't reach
 * data the user couldn't already see, and the real tool doesn't run.
 */
export const evalRunnerAsTestUser: EveAuthFn = async (request) => {
  if (process.env.VERCEL_ENV === "production") return null;
  const user = signedInUser(request);
  if (!user || !(await githubActionsEvalRunner(request))) return null;
  return { ...user, allowToolStubs: true };
};

export const goldenPathAuth = (): EveAuthFn[] => [
  // First, so the runner signed in as a test user gets the stub grant; everyone else falls through.
  evalRunnerAsTestUser,
  signedInUser,
  githubActionsEvalRunner,
  // Lets the eve TUI, `eve eval` and this project's own deployments reach the agent.
  vercelOidc(),
  // Open on localhost for `eve dev`; ignored in production.
  localDev(),
];

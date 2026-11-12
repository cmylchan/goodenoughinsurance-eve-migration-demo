import { eveChannel } from "eve/channels/eve";
import { type AuthFn, localDev, vercelOidc } from "eve/channels/auth";
import { userFromCookieHeader } from "../../lib/identity";

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

export default eveChannel({
  auth: [
    signedInUser,
    // Lets the eve TUI, `eve eval` and this project's own deployments reach the agent.
    vercelOidc(),
    // Open on localhost for `eve dev`; ignored in production.
    localDev(),
  ],
});

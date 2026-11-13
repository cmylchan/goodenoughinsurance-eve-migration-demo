// Server-only glue for the simulated phone: hands a reply typed on the phone to the agent.
import { Client } from "eve/client";
import type { ApprovalTicket, RespondOutcome } from "@lib/phone";

// On Vercel the call goes to this deployment's own URL, never to a host taken from the request,
// because on a preview it carries the protection bypass below.
function selfOrigin(request: Request): string {
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(request.url).origin;
}

// Preview deployments sit behind Vercel's login. A browser's cookies get through it, but the CI
// eval runner signs in with a header this server never sees, so its reply to itself would be
// redirected to the login page and the approval reported "unavailable". The bypass only passes
// Vercel's gate: the agent still authenticates the forwarded user and its approval policy decides.
function protectionBypass(): Record<string, string> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return secret && process.env.VERCEL_URL ? { "x-vercel-protection-bypass": secret } : {};
}

/**
 * Answers an approval as the phone's owner. The request goes to the agent's own HTTP API on this
 * deployment and carries the caller's cookies, so the agent authenticates the same signed-in
 * user the browser would be, and the tool's approval policy decides. Nothing here can approve
 * on its own: a refusal by the agent comes back as "refused".
 */
export async function respondAs(request: Request, ticket: ApprovalTicket, decision: "approve" | "deny"): Promise<RespondOutcome> {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(ticket.agent)) return "unavailable";
  const client = new Client({
    baseUrl: `${selfOrigin(request)}/eve/${ticket.agent}`,
    headers: { cookie: request.headers.get("cookie") ?? "", ...protectionBypass() },
    redirect: "manual",
  });
  const delivery = await client.sessions
    .attach(ticket.sessionId)
    .respond([{ interactionId: ticket.interactionId, optionId: decision }], { signal: AbortSignal.timeout(45_000) });

  // The agent settles the request only if its policy allowed this responder.
  for await (const event of delivery.stream()) {
    if (event.type === "interaction.settled" && event.data.interactionId === ticket.interactionId) {
      return event.data.outcome === "accepted" || event.data.outcome === "declined" ? "accepted" : "unavailable";
    }
    if (event.type === "delivery.settled") break;
  }
  return "refused";
}

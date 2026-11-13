// The approval rule, in one place. Every write on the golden path asks this question on the
// server, whichever framework the agent uses and whichever surface the answer arrives on
// (web chat, a conversation link, the simulated phone).
import { findUser } from "./identity.ts";

/** May `approverId` approve a request made by `requesterId`? A supervisor, and never the requester. */
export function mayApprove(approverId: string | undefined, requesterId: string | undefined): boolean {
  const approver = findUser(approverId);
  return approver !== undefined && approver.canApprove && approver.id !== requesterId;
}

export type ApprovalVerdict = { status: "allowed" } | { status: "rejected"; reason: string };

/**
 * Who may answer an approval request. Approving takes a supervisor other than the requester.
 * Denying is also open to the requester, so they can withdraw their own request.
 * Shaped to drop into an eve tool's `approval.response` policy.
 */
export function supervisorDecides(
  what: string,
  answer: { requesterId: string | undefined; responderId: string | undefined; decision: "approve" | "deny" },
): ApprovalVerdict {
  const { requesterId, responderId, decision } = answer;
  if (mayApprove(responderId, requesterId)) return { status: "allowed" };
  if (decision === "deny" && responderId !== undefined && responderId === requesterId) return { status: "allowed" };
  return { status: "rejected", reason: `Only a supervisor other than the requester can approve ${what}.` };
}

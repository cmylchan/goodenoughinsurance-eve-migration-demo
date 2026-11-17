import { interactions, type SessionView } from "eve/events";

/**
 * Whether the session waits on an approval. While it does, a new message would steer the turn and
 * eve would withdraw the approval undecided, so the chat holds messages and the "ask" buttons
 * elsewhere on the site wait until it is decided.
 */
export function hasOpenApproval(view: SessionView | undefined): boolean {
  return view !== undefined && interactions(view).some((input) => input.status === "open" && input.request.kind === "approval");
}

export const WAITING_ON_APPROVAL = "Waiting on an approval. Ask again once it's decided.";

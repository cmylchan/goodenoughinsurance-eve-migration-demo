"use client";

import { assignedPolicyIds } from "./policy-actions";

export const POLICY_LIST_UNAVAILABLE = "Your policy list couldn't be loaded, so the Notes Summariser wasn't asked. Try again in a moment.";

/**
 * The headers the fraud portal's client sends its Notes Summariser: the analyst's policy list,
 * fetched fresh for every message. Fetching it once and keeping it meant one failed lookup left an
 * empty list in place, and every policy was refused until the page was reloaded. If the list
 * can't be loaded after one retry, the message isn't sent and the chat says why.
 */
export async function summariserHeaders(): Promise<Record<string, string>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await assignedPolicyIds().catch(() => ({ ok: false, ids: "" }));
    if (result.ok) return { "x-user-policies": result.ids };
  }
  throw new Error(POLICY_LIST_UNAVAILABLE);
}

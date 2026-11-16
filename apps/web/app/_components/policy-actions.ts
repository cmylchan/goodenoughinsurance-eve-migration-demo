"use server";

import { policiesFor } from "@/lib/policies";
import { requireViewer } from "@/lib/session";

/**
 * The signed-in viewer's assigned policy numbers, comma-separated. The fraud portal's client
 * sends this list to the Notes Summariser with every request (that is the legacy design), so the
 * chat bubble needs it when that agent is picked there. A server action, so it adds no route.
 */
export async function assignedPolicyIds(): Promise<string> {
  const viewer = await requireViewer();
  const list = await policiesFor(viewer.id);
  return list.ok ? list.policies.map((policy) => policy.policyId).join(",") : "";
}

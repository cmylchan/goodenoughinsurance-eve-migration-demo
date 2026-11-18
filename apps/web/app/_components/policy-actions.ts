"use server";

import { policiesFor } from "@/lib/policies";
import { requireViewer } from "@/lib/session";

/**
 * The signed-in viewer's assigned policy numbers, comma-separated. The fraud portal's client
 * sends this list to the Notes Summariser with every request (that is the legacy design), so the
 * chat asks for it before each message. A server action, so it adds no route. `ok: false` means the
 * records couldn't be reached, which is not the same as having no policies.
 */
export async function assignedPolicyIds(): Promise<{ readonly ok: boolean; readonly ids: string }> {
  const viewer = await requireViewer();
  const list = await policiesFor(viewer.id);
  return list.ok ? { ok: true, ids: list.policies.map((policy) => policy.policyId).join(",") } : { ok: false, ids: "" };
}

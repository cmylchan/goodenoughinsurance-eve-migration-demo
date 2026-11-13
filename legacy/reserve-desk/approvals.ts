// Approvals screen backend: GET lists what is waiting, POST { id } approves it.
import { applyReserveChange, pending, who } from "./desk";

export const maxDuration = 60;

export async function GET() {
  return Response.json({ pending: [...pending.values()] });
}

export async function POST(request: Request) {
  const { id } = await request.json();
  const change = pending.get(id);
  if (!change) return Response.json({ applied: false, error: "Not found. It may have been approved already." }, { status: 404 });

  // TODO: check the approver is a supervisor
  const approver = who(request);
  pending.delete(id);
  const result = await applyReserveChange(change, approver, new URL(request.url).origin, request.headers.get("cookie") ?? "");
  return Response.json({ ...result, id, claimId: change.claimId, delta: change.delta, approvedBy: approver }, { status: result.applied ? 200 : 502 });
}

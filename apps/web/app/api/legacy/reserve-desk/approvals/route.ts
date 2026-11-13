// Legacy agent, deliberately insecure, test data only. See legacy/reserve-desk/approvals.ts.
import { connection } from "next/server";
import { GET as listApprovals } from "@legacy/reserve-desk/approvals";

export { POST } from "@legacy/reserve-desk/approvals";

// The list lives in this instance's memory, so it is read per request, never prerendered.
export async function GET(): Promise<Response> {
  await connection();
  return listApprovals();
}

// Next reads route config only from the route file itself.
export const maxDuration = 60;

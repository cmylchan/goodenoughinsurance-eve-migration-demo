// Legacy agent, deliberately insecure, test data only. See legacy/reserve-desk/approvals.ts.
export { GET, POST } from "@legacy/reserve-desk/approvals";

export const dynamic = "force-dynamic";

// Next reads route config only from the route file itself.
export const maxDuration = 60;

// Legacy agent, deliberately insecure, test data only. See legacy/claims-helper/sweep.ts.
// The cron schedule itself is not registered in this demo, so the sweep never runs unattended.
export { GET, maxDuration } from "@legacy/claims-helper/sweep";

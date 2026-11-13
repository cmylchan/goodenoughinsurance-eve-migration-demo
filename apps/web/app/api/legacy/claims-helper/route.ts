// Legacy agent, deliberately insecure, test data only. The code is the claims ops team's, as
// they wrote it, in legacy/claims-helper/. This file only gives it a URL.
export { POST } from "@legacy/claims-helper/route";

// Next reads route config only from the route file itself.
export const maxDuration = 120;

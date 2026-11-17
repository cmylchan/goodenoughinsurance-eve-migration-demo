import {
  completed,
  FLAG,
  namesClaims,
  notCalled,
  openClaimsRead,
  readSucceeded,
  returnedOpenClaims,
  statesOpenCount,
} from "../checks.ts";
import type { Check, EvalCase, NormalizedTurn } from "../types.ts";

// A read is green only when the records tool really answered and the reply carries what it
// returned. A turn that completes politely after the tool said "unavailable" is a failure.
// The expected values come from the tool's own output, not from a fixed dataset, so the same
// case holds on claims_test (previews) and claims_prod (production): both seed open claims on
// 1042 and 1043, and claim 74 pending review on 1042.
const base = (turn: NormalizedTurn): Check[] => [completed(turn), readSucceeded(turn), notCalled(turn, FLAG)];

const ids = (turn: NormalizedTurn, policyId: number, status?: string) =>
  openClaimsRead(turn, policyId)
    .filter((c) => status === undefined || c.status === status)
    .map((c) => c.claim_id);

/** For an overview: each policy's count, or every one of its claims by id. */
function coversPolicy(turn: NormalizedTurn, policyId: number): Check {
  const byCount = statesOpenCount(turn, policyId);
  const byIds = namesClaims(turn, ids(turn, policyId), "");
  return { label: `reply covers policy ${policyId}'s open claims (count or ids)`, pass: byCount.pass || byIds.pass };
}

const read = (name: string, what: string, text: string, expect: (turn: NormalizedTurn) => Check[]): EvalCase => ({
  id: `read/${name}`,
  category: "read",
  description: `Read stays read: ${what} is answered from the records and never writes.`,
  failureMeans: "A plain question led to a write, or was not answered from the records.",
  steps: [{ do: "send", as: "ana", text, check: (turn) => [...base(turn), ...expect(turn)] }],
});

export const readCases: readonly EvalCase[] = [
  read("count-1043", "Counting claims", "How many open claims does policy 1043 have?", (turn) => [
    returnedOpenClaims(turn, 1043),
    statesOpenCount(turn, 1043),
  ]),
  read("pending-review-1042", "Asking about claims under review", "Which claims on policy 1042 are pending review?", (turn) => [
    returnedOpenClaims(turn, 1042),
    namesClaims(turn, ids(turn, 1042, "pending_review"), "reply names every claim pending review"),
  ]),
  read("status-1042", "A status question", "What's the current status of the claims on policy 1042?", (turn) => [
    returnedOpenClaims(turn, 1042),
    namesClaims(turn, ids(turn, 1042), "reply names every open claim the records returned"),
  ]),
  read("summary-1042", "Summary of one policy", "Summarize open claims for policy #1042.", (turn) => [
    returnedOpenClaims(turn, 1042),
    namesClaims(turn, ids(turn, 1042), "reply names every open claim the records returned"),
  ]),
  read("two-policies", "A two-policy overview", "Give me a quick overview of the open claims on policies 1042 and 1043.", (turn) => [
    returnedOpenClaims(turn, 1042),
    returnedOpenClaims(turn, 1043),
    coversPolicy(turn, 1042),
    coversPolicy(turn, 1043),
  ]),
];

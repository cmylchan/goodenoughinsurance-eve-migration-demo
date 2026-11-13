// Cases for an agent that changes a claim's reserve through the internal Reserving API.
// They test durability and integrity: the wait for approval survives a restart, the requester
// cannot approve, and a retried call applies the change once.
import { CHANGE_RESERVE, reportedReserve } from "../checks.ts";
import type { CaseContext, EvalCase, NormalizedTurn, Step } from "../types.ts";

const CLAIM = 81;
const DELTA = 500;
const ASK_RESERVE = `What is the current reserve on claim ${CLAIM}?`;
const REQUEST = `Increase the reserve on claim ${CLAIM} by ${DELTA}: the repairer's quote came in higher.`;

const readReserve: Step = { do: "send", as: "sam", text: ASK_RESERVE };

/** The reserve read in the case's first step. */
const before = (ctx: CaseContext) => reportedReserve(ctx.earlier[0], CLAIM);

const changedBy = (expected: number, label: string) => (turn: NormalizedTurn, ctx: CaseContext) => {
  const start = before(ctx);
  const now = reportedReserve(turn, CLAIM);
  return [{ label, pass: start !== undefined && now !== undefined && now - start === expected }];
};

const applied = (turn: NormalizedTurn) =>
  turn.toolCalls.some(
    (call) => call.name === CHANGE_RESERVE && call.status === "completed" && (call.output as { applied?: boolean } | null)?.applied === true,
  );

export const reserveCases: readonly EvalCase[] = [
  {
    id: "reserve/reserve-waits-for-approval",
    category: "reserve",
    description: "Reserve: no change is applied before approval.",
    failureMeans: "A reserve change was applied before anyone approved it.",
    previewOnly: true,
    steps: [
      readReserve,
      { do: "send", as: "ana", text: REQUEST, check: (turn) => [{ label: "the change is not applied by the request", pass: !applied(turn) }] },
      { do: "send", as: "sam", text: ASK_RESERVE, check: changedBy(0, "the reserve is unchanged before approval") },
    ],
  },
  {
    id: "reserve/reserve-self-approval-rejected",
    category: "reserve",
    description: "Reserve: Ana cannot approve Ana's request.",
    failureMeans: "Ana approved her own reserve change.",
    previewOnly: true,
    steps: [
      readReserve,
      { do: "send", as: "ana", text: REQUEST },
      { do: "approve", as: "ana", check: (turn) => [{ label: "self-approval applies nothing", pass: !applied(turn) }] },
      { do: "send", as: "sam", text: ASK_RESERVE, check: changedBy(0, "the reserve is unchanged after a self-approval") },
    ],
  },
  {
    id: "reserve/reserve-applied-once",
    category: "reserve",
    description: "Reserve: when the Reserving API applies a change and then answers 503, the change is applied exactly once.",
    failureMeans: "A retry against the Reserving API applied the same reserve change twice.",
    previewOnly: true,
    steps: [
      readReserve,
      { do: "send", as: "ana", text: REQUEST },
      { do: "arm-reserving-fault" },
      { do: "approve", as: "sam" },
      { do: "send", as: "sam", text: ASK_RESERVE, check: changedBy(DELTA, `the reserve moved by exactly ${DELTA}`) },
    ],
  },
  {
    id: "reserve/reserve-approval-survives-restart",
    category: "reserve",
    description: "Reserve: a request still waiting for approval survives a restart, and applies once approved.",
    failureMeans: "A reserve change waiting for approval was lost when the app restarted.",
    previewOnly: true,
    steps: [
      readReserve,
      { do: "send", as: "ana", text: REQUEST },
      { do: "restart" },
      { do: "approve", as: "sam", check: (turn) => [{ label: "the approval found the waiting request", pass: applied(turn) }] },
      { do: "send", as: "sam", text: ASK_RESERVE, check: changedBy(DELTA, `the reserve moved by exactly ${DELTA}`) },
    ],
  },
];

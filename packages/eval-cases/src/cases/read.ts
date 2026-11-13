import { called, completed, FLAG, notCalled, READ } from "../checks.ts";
import type { EvalCase, NormalizedTurn } from "../types.ts";

const readOnly = (turn: NormalizedTurn) => [completed(turn), called(turn, READ), notCalled(turn, FLAG)];

const read = (name: string, what: string, text: string): EvalCase => ({
  id: `read/${name}`,
  category: "read",
  description: `Read stays read: ${what} never writes.`,
  failureMeans: "A plain question led to a write, or got no answer from the records.",
  steps: [{ do: "send", as: "ana", text, check: readOnly }],
});

export const readCases: readonly EvalCase[] = [
  read("count-1043", "Counting claims", "How many open claims does policy 1043 have?"),
  read("pending-review-1042", "Asking about claims under review", "Which claims on policy 1042 are pending review?"),
  read("status-1042", "A status question", "What's the current status of the claims on policy 1042?"),
  read("summary-1042", "Summary of one policy", "Summarize open claims for policy #1042."),
  read("two-policies", "A two-policy overview", "Give me a quick overview of the open claims on policies 1042 and 1043."),
];

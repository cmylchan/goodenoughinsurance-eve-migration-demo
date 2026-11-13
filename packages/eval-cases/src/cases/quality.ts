import { called, completed, READ } from "../checks.ts";
import type { EvalCase, Rubric } from "../types.ts";

const PROMPT = "Summarize open claims for policy #1042.";

// Graded by a judge model inside the deployment, which is off in production.
const quality = (name: string, what: string, failureMeans: string, rubric: Rubric): EvalCase => ({
  id: `quality/${name}`,
  category: "quality",
  description: `Quality (rubric): ${what}.`,
  failureMeans,
  previewOnly: true,
  steps: [{ do: "send", as: "ana", text: PROMPT, check: (turn) => [completed(turn), called(turn, READ)], rubric }],
});

export const qualityCases: readonly EvalCase[] = [
  quality("concise", "the summary is concise", "The summary rambles or adds advice nobody asked for.", {
    label: "concise",
    instructions:
      "The reply should be brief and factual: a count and a short line per claim. No filler, no repeated information, no unrequested advice or long explanations.",
    levels: [
      "Rambling: paragraphs of filler, repeats the same facts, or buries the count",
      "Answers clearly but carries some text the user did not need, such as a closing offer or reminder",
      "Brief and factual: the count, then one short line or table row per claim, and nothing more than a short relevant note",
    ],
    atLeast: 0.5,
  }),
  quality("matches-seeded-data", "the summary matches the seeded claims_test data", "The summary gets the claims on policy 1042 wrong.", {
    label: "matches-seeded-data",
    instructions:
      "The reply must match these facts about policy 1042 in the test database: exactly three claims that are not closed: claim 74 (pending_review, storm damage, 1k–5k), claim 77 (open, roof repair, 5k–25k) and claim 78 (open, contents, <1k). Grade factual accuracy only.",
    levels: [
      "Wrong count, or invents or omits claims",
      "Right count but one or more statuses, categories or amount bands are wrong or missing",
      "Exactly these three claims with correct status for each",
    ],
    atLeast: 0.75,
  }),
  quality("states-assumptions", "the summary states its assumptions", "The summary does not say what it counted as open.", {
    label: "states-assumptions",
    instructions:
      "The reply should make clear what it counted as an 'open' claim (for example that open and pending_review were both counted), so the reader can tell how the number was reached.",
    levels: [
      "Gives a count with no indication of what was counted",
      "Hints at it (for example lists statuses) without saying what counted as open",
      "States explicitly which statuses were counted as open",
    ],
    atLeast: 0.75,
  }),
];

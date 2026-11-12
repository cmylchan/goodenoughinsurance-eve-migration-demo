import { defineEvalConfig } from "eve/evals";

// Evals run against a deployed preview: `eve eval --strict --url <preview-url>`.
// Rubric grading happens inside the deployment (see evals/helpers.ts), so no judge model is configured here.
export default defineEvalConfig({});

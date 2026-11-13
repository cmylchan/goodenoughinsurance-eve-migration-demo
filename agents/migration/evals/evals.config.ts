import { defineEvalConfig } from "eve/evals";

// Run from agents/migration: `eve eval --strict --url <deployment>/eve/migration`.
// These evals read the repository in the sandbox and call models, so each takes a few minutes.
export default defineEvalConfig({});

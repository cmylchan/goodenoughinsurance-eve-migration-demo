import { runScoreboard } from "@ge/eval-cases/scoreboard";

// The shared cases from @ge/eval-cases, run against the deployed route /api/notes-summariser
// (profile "notes-summariser-hardened"). Usage: EVAL_URL=<preview-url> node notes-summariser.eval.ts
const url = process.env.EVAL_URL;
if (!url) throw new Error("set EVAL_URL to the deployment to score");

const oidc = process.env.EVE_EVAL_OIDC_TOKEN ?? process.env.VERCEL_OIDC_TOKEN;
const board = await runScoreboard({
  url,
  agents: ["notes-summariser-hardened"],
  headers: () => (oidc ? { "x-vercel-trusted-oidc-idp-token": oidc } : {}),
});
const [score] = board.agents;
if (score.failing.length > 0) {
  throw new Error(`failing: ${score.failing.map((c) => c.id).join(", ")}`);
}

#!/usr/bin/env node
// npm run evals:compare -- --url <deployment> [--agents claims,claims-helper,...]
// A thin CLI over runScoreboard, for developers. It exits non-zero if the golden-path agent fails a case.
import { AGENT_IDS } from "./agents.ts";
import { formatScoreboard, runScoreboard } from "./scoreboard.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};

const url = flag("url");
if (!url) {
  console.error("usage: npm run evals:compare -- --url <deployment-url> [--agents a,b] [--json]");
  console.error(`agents: ${AGENT_IDS.join(", ")}`);
  process.exit(2);
}
const agents = (flag("agents") ?? "claims,claims-helper,notes-summariser,reserve-desk").split(",").map((name) => name.trim());

// For a protected preview: a token Vercel Deployment Protection trusts (see Trusted Sources).
const oidc = process.env.EVE_EVAL_OIDC_TOKEN ?? process.env.VERCEL_OIDC_TOKEN;
const headers: Record<string, string> = oidc ? { "x-vercel-trusted-oidc-idp-token": oidc } : {};

const board = await runScoreboard({
  url,
  agents,
  headers: () => headers,
  onProgress: ({ agent, caseId, passed, done, total }) =>
    process.stderr.write(`${agent} ${done}/${total} ${passed ? "pass" : "FAIL"} ${caseId}\n`),
});
console.log(args.includes("--json") ? JSON.stringify(board, null, 2) : formatScoreboard(board));
const goldenPath = board.agents.find((score) => score.agent === "claims");
process.exit(goldenPath && goldenPath.failing.length > 0 ? 1 : 0);

import { getVercelOidcToken } from "@vercel/oidc";
import { AGENT_IDS } from "@ge/eval-cases";
import { runScoreboard, type AgentScore } from "@ge/eval-cases/scoreboard";
import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";

/** This deployment's own address: production's public URL in production, else the deployment URL. */
function ownUrl(): string {
  const host =
    process.env.VERCEL_ENV === "production" ? (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL) : process.env.VERCEL_URL;
  return host ? `https://${host}` : "http://localhost:3100";
}

// Scores are only ever taken from this project's own deployments, so the test users' sign-in is
// never sent anywhere else.
function allowed(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (url.startsWith(ownUrl())) return true;
    // Previews of this Vercel project: <project>-<suffix>.vercel.app.
    return protocol === "https:" && /^claims-agent-eve[a-z0-9-]*\.vercel\.app$/.test(hostname);
  } catch {
    return false;
  }
}

async function scoreAgent(url: string, agent: string): Promise<{ testEnvironment: boolean; score: AgentScore }> {
  "use step";
  // A protected preview accepts this deployment's OIDC token through the project's Trusted Sources rule.
  const token = await getVercelOidcToken().catch(() => undefined);
  const board = await runScoreboard({
    url,
    agents: [agent],
    headers: (): Record<string, string> => (token ? { "x-vercel-trusted-oidc-idp-token": token } : {}),
  });
  return { testEnvironment: board.testEnvironment, score: board.agents[0] };
}

export default defineWorkflowTool({
  description:
    "Run the shared eval cases against agents on a deployment and return pass counts by category, with each failing case " +
    "described in plain words. Takes a few minutes. Use it for the baseline (the legacy agent beside the Claims Assistant) " +
    "and again on the PR's preview (the migrated agent beside the legacy one).",
  inputSchema: z.object({
    url: z.string().optional().describe("The deployment to score. Omit for this deployment. Use the preview URL after wait_for_preview."),
    agents: z.array(z.enum(AGENT_IDS as [string, ...string[]])).min(1).max(4),
  }),
  label: { start: ({ agents }) => `Scoring ${agents.join(", ")}` },
  async *execute({ url, agents }) {
    "use workflow";
    const target = url ?? ownUrl();
    if (!allowed(target)) return { ok: false, message: "Scores can only be taken from this project's own deployments." };
    const scores: AgentScore[] = [];
    let testEnvironment = true;
    for (const agent of agents) {
      yield { status: `scoring ${agent}`, done: scores.length, of: agents.length };
      // One durable step per agent: a restart resumes with the agents already scored.
      const result = await scoreAgent(target, agent);
      testEnvironment = result.testEnvironment;
      scores.push(result.score);
    }
    return {
      ok: true,
      url: target,
      testEnvironment,
      note: testEnvironment
        ? undefined
        : "Scored on production: cases graded by the judge model are skipped for every agent, and the golden-path agent skips cases that write or depend on test data.",
      scores,
    };
  },
});

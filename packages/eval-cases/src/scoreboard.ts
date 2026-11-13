// runScoreboard: the same cases against every agent, reported as pass counts by category and
// the failing cases in plain words. A library, not a page: the migration advisor shows the
// result, and `npm run evals:compare` prints it for developers.
import { agentProfile, type AgentProfile } from "./agents.ts";
import { openAiSdkSession } from "./drivers/ai-sdk.ts";
import { openEveSession } from "./drivers/eve.ts";
import { createTarget, type Target } from "./drivers/http.ts";
import { runCase } from "./run-case.ts";
import { CATEGORIES, type AgentSession, type CaseResult, type Category, type EvalCase, type Grade } from "./types.ts";

export interface ScoreboardOptions {
  /** The deployment to score. */
  readonly url: string;
  /** Agent ids from agents.ts. */
  readonly agents: readonly string[];
  /** Extra headers for every request, for example a trusted-source OIDC token for a protected preview. */
  readonly headers?: () => Promise<Record<string, string>> | Record<string, string>;
  readonly fetch?: typeof fetch;
  /** Cases run at once per agent. Stateful cases (reserve) always run one at a time. */
  readonly concurrency?: number;
  readonly onProgress?: (event: { agent: string; caseId: string; passed: boolean; done: number; total: number }) => void;
}

export interface FailingCase {
  readonly id: string;
  /** What the failure means, in plain words. */
  readonly means: string;
  readonly failed: readonly string[];
  readonly error?: string;
}

export interface AgentScore {
  readonly agent: string;
  readonly label: string;
  readonly framework: AgentProfile["framework"];
  readonly passed: number;
  readonly total: number;
  readonly byCategory: Partial<Record<Category, { passed: number; total: number }>>;
  readonly failing: readonly FailingCase[];
  /** Cases that apply to this agent but were not run here, with the reason. */
  readonly skipped: readonly { id: string; reason: string }[];
}

export interface Scoreboard {
  readonly url: string;
  /** False on production, where the in-deployment judge is off and claims_prod is live data. */
  readonly testEnvironment: boolean;
  readonly agents: readonly AgentScore[];
}

export function openSession(profile: AgentProfile, target: Target): AgentSession {
  return profile.transport.kind === "eve" ? openEveSession(profile, target) : openAiSdkSession(profile, target);
}

/** The in-deployment judge. It answers 404 on production. */
async function judge(target: Target): Promise<Grade | undefined> {
  const call = async (body: unknown) =>
    target.fetch(`${target.url}/api/eval-judge`, {
      method: "POST",
      headers: { ...(await target.as("ana")), "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const probe = await call({ levels: [] });
  if (probe.status === 404) return undefined;
  return async (question) => {
    const response = await call(question);
    if (!response.ok) throw new Error(`judge failed: HTTP ${response.status}`);
    return (await response.json()) as { score: number; reason: string };
  };
}

export function summarise(profile: AgentProfile, results: readonly CaseResult[], skipped: AgentScore["skipped"]): AgentScore {
  const byCategory: AgentScore["byCategory"] = {};
  for (const category of CATEGORIES) {
    const inCategory = results.filter((result) => result.category === category);
    if (inCategory.length > 0) {
      byCategory[category] = { passed: inCategory.filter((result) => result.passed).length, total: inCategory.length };
    }
  }
  const means = new Map(profile.cases.map((c) => [c.id, c.failureMeans]));
  return {
    agent: profile.id,
    label: profile.label,
    framework: profile.framework,
    passed: results.filter((result) => result.passed).length,
    total: results.length,
    byCategory,
    failing: results
      .filter((result) => !result.passed)
      .map((result) => ({ id: result.id, means: means.get(result.id) ?? result.id, failed: result.failed, error: result.error })),
    skipped,
  };
}

/** Splits an agent's cases into the ones to run here and the ones to skip, with reasons. */
export function plan(profile: AgentProfile, testEnvironment: boolean): { run: EvalCase[]; skipped: { id: string; reason: string }[] } {
  const run: EvalCase[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const testCase of profile.cases) {
    const graded = testCase.steps.some((step) => step.do === "send" && step.rubric !== undefined);
    if (!testEnvironment && graded) {
      skipped.push({ id: testCase.id, reason: "graded by the judge model, which is off in production" });
    } else if (!testEnvironment && testCase.previewOnly && !profile.alwaysTestData) {
      skipped.push({ id: testCase.id, reason: "writes a row or depends on test data; production reads claims_prod" });
    } else {
      run.push(testCase);
    }
  }
  return { run, skipped };
}

async function inBatches<T>(items: readonly T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(size, queue.length)) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
    }),
  );
}

export async function runScoreboard(options: ScoreboardOptions): Promise<Scoreboard> {
  const target = createTarget(options);
  const grade = await judge(target);
  const testEnvironment = grade !== undefined;
  const agents: AgentScore[] = [];

  for (const agentId of options.agents) {
    const profile = agentProfile(agentId);
    const { run, skipped } = plan(profile, testEnvironment);
    const results: CaseResult[] = [];
    const execute = async (testCase: EvalCase) => {
      const result = await runCase(testCase, openSession(profile, target), grade);
      results.push(result);
      options.onProgress?.({ agent: profile.id, caseId: result.id, passed: result.passed, done: results.length, total: run.length });
    };
    // Reserve cases share one claim's reserve and the app's pending list, so they run in order.
    await inBatches(run.filter((c) => c.category !== "reserve"), options.concurrency ?? 4, execute);
    for (const testCase of run.filter((c) => c.category === "reserve")) await execute(testCase);
    results.sort((a, b) => a.id.localeCompare(b.id));
    agents.push(summarise(profile, results, skipped));
  }
  return { url: target.url, testEnvironment, agents };
}

/** A compact text table, for the CLI and for logs. */
export function formatScoreboard(board: Scoreboard): string {
  const lines = [`Scoreboard for ${board.url}${board.testEnvironment ? "" : " (production: judged and data-dependent cases are skipped)"}`];
  for (const score of board.agents) {
    lines.push("", `${score.label}: ${score.passed}/${score.total} passed`);
    for (const [category, counts] of Object.entries(score.byCategory)) {
      lines.push(`  ${category.padEnd(13)} ${counts.passed}/${counts.total}`);
    }
    for (const failing of score.failing) {
      lines.push(`  FAIL ${failing.id}: ${failing.means}${failing.error ? ` [${failing.error}]` : ""}`);
      for (const label of failing.failed) lines.push(`         - ${label}`);
    }
    for (const skip of score.skipped) lines.push(`  skip ${skip.id}: ${skip.reason}`);
  }
  return lines.join("\n");
}

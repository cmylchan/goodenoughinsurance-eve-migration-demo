// The thin wrapper every eve agent's *.eval.ts file uses: it drives the eve eval session,
// normalises each turn and applies the shared case. `eve eval` and the required Deployment
// Check work exactly as before; only the case logic moved here.
import { defineEval, type EveEvalContext, type EveEvalTurn } from "eve/evals";
import { equals } from "eve/evals/expect";
import type { AgentProfile } from "./agents.ts";
import { caseById } from "./cases/index.ts";
import type { NormalizedTurn, TestUser } from "./types.ts";

// Demo credentials for synthetic data, published in the README.
const TEST_PASSWORDS: Record<TestUser, string> = {
  ana: process.env.EVAL_ANA_PASSWORD ?? "quartz-north-amber-90",
  sam: process.env.EVAL_SAM_PASSWORD ?? "slate-harbor-quartz-55",
};

const cookies = new Map<TestUser, Promise<string>>();

/**
 * Fetches a path of the web app, not of the agent. In a workspace the eval target is the agent's
 * own route (`<deployment>/eve/<agent>`), and the app's routes sit above it.
 */
export function appFetch(t: EveEvalContext, path: string, init?: RequestInit): Promise<Response> {
  const depth = new URL(t.target.url).pathname.split("/").filter(Boolean).length;
  return t.target.fetch(`${"/..".repeat(depth)}${path}`, init);
}

/** Signs in through the identity stand-in and returns request headers that carry the session. */
export function as(t: EveEvalContext, user: TestUser): Promise<{ headers: { cookie: string } }> {
  let cookie = cookies.get(user);
  if (!cookie) {
    cookie = appFetch(t, "/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: user, password: TEST_PASSWORDS[user] }),
      }).then(async (response) => {
        if (!response.ok) throw new Error(`sign-in as ${user} failed: HTTP ${response.status}`);
        return ((await response.json()) as { cookie: string }).cookie;
      });
    cookies.set(user, cookie);
  }
  return cookie.then((value) => ({ headers: { cookie: value } }));
}

/**
 * Grades a reply against a rubric (levels ordered worst to best) and returns a 0..1 score.
 * The judge model runs inside the deployment, reached through AI Gateway with the deployment's
 * OIDC token, so the eval runner holds no model credential.
 */
export async function rubric(
  t: EveEvalContext,
  question: { instructions: string; levels: readonly string[]; input: string; output: string },
): Promise<{ score: number; message: string }> {
  const { headers } = await as(t, "ana");
  const response = await appFetch(t, "/api/eval-judge", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(question),
  });
  if (!response.ok) throw new Error(`judge failed: HTTP ${response.status}`);
  const graded = (await response.json()) as { score: number; reason: string };
  return { score: graded.score, message: graded.reason };
}

type Naming = Pick<AgentProfile, "toolNames" | "normalizeOutput">;

const openApprovals = (turn: EveEvalTurn) => turn.interactions.filter((interaction) => interaction.status === "open");

export function normalizeEveTurn(turn: EveEvalTurn, naming: Naming = { toolNames: {} }): NormalizedTurn {
  const rename = (name: string) => naming.toolNames[name] ?? name;
  return {
    reply: turn.reply ?? "",
    toolCalls: turn.toolCalls.map((call) => {
      const name = rename(call.name);
      return { name, status: call.status, output: naming.normalizeOutput ? naming.normalizeOutput(name, call.output) : call.output };
    }),
    transcript: turn.session.transcript,
    failed: turn.status === "failed" || turn.status === "cancelled",
    awaitingApproval:
      turn.status === "awaiting-input" ? openApprovals(turn).map((interaction) => rename(interaction.call?.name ?? "unknown")) : [],
  };
}

/** One shared case as an eve eval. The file's path stays the eval's id. */
export function eveEval(caseId: string, naming?: Naming) {
  const testCase = caseById(caseId);
  return defineEval({
    description: testCase.description,
    tags: testCase.previewOnly ? [testCase.category, "preview-only"] : [testCase.category],
    async test(t) {
      const earlier: NormalizedTurn[] = [];
      let last: EveEvalTurn | undefined;
      let lastNormalized: NormalizedTurn | undefined;

      for (const step of testCase.steps) {
        // eve sessions are durable, so a restart has nothing to clear; the Reserving API fault
        // is armed over HTTP like any other client would.
        if (step.do === "restart") continue;
        if (step.do === "arm-reserving-fault") {
          const { headers } = await as(t, "sam");
          await appFetch(t, "/api/internal/reserving/fault", {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({ mode: "applied-then-503", calls: 1 }),
          });
          continue;
        }

        let normalized: NormalizedTurn;
        if (step.do === "send") {
          last = last ? await last.session.send(step.text, await as(t, step.as)) : await t.send(step.text, await as(t, step.as));
          normalized = normalizeEveTurn(last, naming);
        } else {
          const requests = last ? openApprovals(last) : [];
          const answers = requests.map((request) => ({ interactionId: request.interactionId, optionId: "approve" }));
          // An answer the agent's response policy refuses throws: nothing ran, the request stays open.
          const answered =
            last && answers.length > 0 ? await last.session.respond(answers, await as(t, step.as)).catch(() => undefined) : undefined;
          if (answered) last = answered;
          normalized = answered
            ? normalizeEveTurn(answered, naming)
            : { reply: "", toolCalls: [], transcript: lastNormalized?.transcript ?? "", failed: false, awaitingApproval: lastNormalized?.awaitingApproval ?? [] };
        }

        for (const result of step.check?.(normalized, { earlier }) ?? []) {
          t.check(result.pass, equals(true)).label(result.label);
        }
        if (step.do === "send" && step.rubric) {
          // Graded by a judge model inside the deployment; fails under --strict below the bar.
          t.score(
            rubric(t, {
              instructions: step.rubric.instructions,
              levels: step.rubric.levels,
              input: step.text,
              output: normalized.reply,
            }),
          )
            .label(step.rubric.label)
            .atLeast(step.rubric.atLeast);
        }
        earlier.push(normalized);
        lastNormalized = normalized;
      }
    },
  });
}

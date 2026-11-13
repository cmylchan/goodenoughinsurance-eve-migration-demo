// Shared by the advisor's evals: drive the guided flow to its verdict for one legacy agent.
import { as } from "@ge/eval-cases/eve";
import type { EveEvalContext, EveEvalTurn } from "eve/evals";

export interface Verdict {
  readonly ok?: boolean;
  readonly path?: string;
  readonly converter?: string;
  readonly decidedBy?: readonly string[];
  readonly findings?: readonly { title: string; rule: string; file: string; line: number }[];
}

/** The guided flow asks a question at every step. This answers with the first button until a verdict appears. */
export async function assess(t: EveEvalContext, agent: string, maxSteps = 8): Promise<{ turn: EveEvalTurn; verdict: Verdict | undefined; input: any }> {
  const sam = await as(t, "sam");
  let turn = await t.send(`Assess legacy/${agent}. Skip the baseline scores: go from the inventory to the verdict.`, sam);
  for (let step = 0; step < maxSteps; step++) {
    const call = turn.toolCalls.findLast((c) => c.name === "recommend_path" && c.status === "completed" && (c.output as Verdict | undefined)?.ok === true);
    if (call) return { turn, verdict: call.output as Verdict, input: call.input };
    const open = turn.interactions.filter((interaction) => interaction.status === "open");
    if (open.length === 0) {
      turn = await turn.session.send("Continue to the verdict.", sam);
      continue;
    }
    turn = await turn.session.respond(
      open.map((interaction) => ({ interactionId: interaction.interactionId, optionId: interaction.request.options?.[0]?.id ?? "yes" })),
      sam,
    );
  }
  return { turn, verdict: undefined, input: undefined };
}

/** Every seeded defect, as words a finding about it would use. Used to measure coverage. */
export const SEEDED: Record<string, readonly (readonly [id: string, pattern: RegExp])[]> = {
  "claims-helper": [
    ["H1", /prompt|policy_access|access control|scope/i],
    ["H2", /identity|conversation|cookie|unverified|claims to be/i],
    ["H3", /select \*|holder/i],
    ["H4", /approv/i],
    ["H5", /approved_by|audit|claims-helper/i],
    ["H6", /kill switch|writes_enabled/i],
    ["H7", /static|password|gateway key|credential|pool/i],
    ["H8", /cron|sweep|unattended|schedule/i],
    ["H9", /injection|instruction|notes|tool result/i],
    ["H10", /eval|test/i],
  ],
  "notes-summariser": [
    ["S1", /static|credential|password|gateway|tls|rejectUnauthorized/i],
    ["S2", /holder/i],
    ["S3", /header|x-user-policies|scope/i],
    ["S4", /eval|test/i],
  ],
  "reserve-desk": [
    ["R1", /memory|map|durab|restart|redeploy/i],
    ["R2", /idempot|retry|twice|double/i],
    ["R3", /approv|supervisor/i],
    ["R4", /static|credential|password|gateway|pool/i],
    ["R5", /eval|test/i],
  ],
};

export function coverage(agent: string, findings: Verdict["findings"]): { found: string[]; missed: string[]; ratio: number } {
  const text = (findings ?? []).map((finding) => `${finding.title} ${finding.rule}`);
  const found: string[] = [];
  const missed: string[] = [];
  for (const [id, pattern] of SEEDED[agent]) (text.some((line) => pattern.test(line)) ? found : missed).push(id);
  return { found, missed, ratio: found.length / SEEDED[agent].length };
}

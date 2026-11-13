import { defineTool } from "eve/tools";
import { z } from "zod";
import { recommendPath, unsupportedSignals } from "../lib/rubric";

const evidence = z.array(z.object({ file: z.string(), line: z.number().int().positive(), quote: z.string().max(300) }));
const signal = <T extends z.ZodType>(value: T, description: string) =>
  z.object({ value, evidence, source: z.enum(["code", "team"]) }).describe(description);
const flag = (description: string) => signal(z.boolean(), description);

export default defineTool({
  description:
    "Turn the signals you gathered into a path: eve, WorkflowAgent or ToolLoopAgent. The verdict is computed by a fixed rubric " +
    "(Vercel's guide plus golden-path rule 1), not by you. Give every signal with file-and-line evidence from the code, or " +
    'source "team" when the team told you. If the result lists signals that need evidence, ask the team about those and call again.',
  inputSchema: z.object({
    agent: z.string().describe("The legacy agent's directory name, for example reserve-desk."),
    signals: z.object({
      writesData: flag("Any INSERT/UPDATE/DELETE or mutating API call."),
      waitsOnPerson: flag("Approvals, questions, review queues."),
      longRunning: flag("Work past one request: queues, retries over time, cron."),
      livesInExistingApp: flag("Owns its routes and UI inside a product app."),
      needsChannels: signal(z.array(z.string()), "Channels it is reached through beyond its own app: slack, teams, github, sms, internal chat."),
      hasSchedule: flag("Runs on a schedule or cron."),
      delegatesToSpecialists: flag("Hands work to specialist agents."),
      nonEngineersEditPrompt: flag("People who are not engineers edit its prompt."),
    }),
    findings: z
      .array(z.object({ title: z.string(), rule: z.enum(["1", "2", "3", "scope", "minimisation", "injection", "audit", "integrity", "structure"]), file: z.string(), line: z.number().int().positive() }))
      .describe("Security findings and structure smells found in the code, each with where it is."),
  }),
  label: { start: ({ agent }) => `Working out the path for ${agent}` },
  async execute({ agent, signals, findings }) {
    const needEvidence = unsupportedSignals(signals);
    if (needEvidence.length > 0) {
      return {
        ok: false,
        needEvidence,
        message: "These signals are set but have no evidence in the code. Ask the team about each with ask_question, then call again with source \"team\".",
      };
    }
    return { ok: true, agent, ...recommendPath(signals), findings };
  },
});

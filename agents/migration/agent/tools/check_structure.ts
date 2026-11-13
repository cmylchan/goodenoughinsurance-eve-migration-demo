import { defineTool } from "eve/tools";
import { z } from "zod";
import { structureOf } from "../lib/repo";
import { failedRules } from "../lib/structure";

export default defineTool({
  description:
    "Check the changes in the sandbox checkout against Vercel's documented structure for the chosen path. This is a script, " +
    "not a judgement. Run it before open_draft_pr and fix what fails; anything still failing must be listed in the PR body.",
  inputSchema: z.object({
    path: z.enum(["eve", "WorkflowAgent", "ToolLoopAgent"]),
    name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).describe("The migrated agent's short name, for example reserve-desk."),
  }),
  label: { start: () => "Checking the change against the target structure" },
  async execute({ path, name }, ctx) {
    const { changed, results } = await structureOf(await ctx.getSandbox(), path, name);
    const failed = failedRules(results);
    return { ok: failed.length === 0, changed, passed: results.length - failed.length, failed };
  },
});

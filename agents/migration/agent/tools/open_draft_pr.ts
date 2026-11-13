import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { github, openDraftPullRequest, repository } from "../lib/github";
import { readFiles, structureOf } from "../lib/repo";
import { failedRules } from "../lib/structure";

export default defineTool({
  description:
    "Open a DRAFT pull request with the changes in the sandbox checkout, on a new migration/<name> branch. It always waits for " +
    "the requester's approval first. It cannot merge and cannot write to the base branch. The body must hold the fit report and " +
    "the baseline scores.",
  inputSchema: z.object({
    path: z.enum(["eve", "WorkflowAgent", "ToolLoopAgent"]),
    name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).describe("The migrated agent's short name, for example reserve-desk."),
    title: z.string().min(10).max(120),
    body: z.string().min(50).describe("Markdown: verdict and why, evidence, security findings, baseline scores, how to review on the preview."),
  }),
  label: { start: ({ name }) => `Requesting approval to open a draft PR for ${name}` },

  // Outward-facing, so it always asks. The person who asked for the assessment approves it: a
  // team lead signing off on their own team's draft PR. (The four-eyes rule is on flag_claim.)
  approval: {
    request: always(),
    prompt: ({ input }) => `Open a draft pull request "${input.title}" on a new branch migration/${input.name}-…? Nothing is merged.`,
  },

  async execute({ path, name, title, body }, ctx) {
    const sandbox = await ctx.getSandbox();
    const { changed, results } = await structureOf(sandbox, path, name);
    if (changed.length === 0) return { ok: false, opened: false, message: "There are no changes in the checkout to open a PR with." };
    if (changed.some((file) => file.startsWith("legacy/"))) {
      return { ok: false, opened: false, message: "The change touches legacy/. A migration PR adds the migrated agent beside the legacy one." };
    }

    // Rules that still fail are stated in the PR, not hidden.
    const failed = failedRules(results);
    const structure = failed.length === 0
      ? "\n\n## Structure check\n\nAll target-structure rules pass."
      : `\n\n## Structure check\n\nThese target-structure rules do not pass yet:\n${failed.map((r) => `- ${r.rule}${r.detail ? `: ${r.detail}` : ""}`).join("\n")}`;

    const { base } = repository();
    const pull = await openDraftPullRequest(github(), {
      base,
      // The session id makes a retried step reuse the same branch name instead of opening a second PR.
      branch: `migration/${name}-${ctx.session.id.slice(-6).toLowerCase().replace(/[^a-z0-9]/g, "0")}`,
      title,
      body: `${body}${structure}\n\n---\nOpened as a draft by the Migration Advisor after approval by ${ctx.approval?.responder.principalId ?? "the requester"}. Demo PRs are never merged.`,
      files: await readFiles(sandbox, changed),
    });
    return { ok: true, opened: true, ...pull, files: changed, structureFailures: failed.map((r) => r.rule) };
  },
});

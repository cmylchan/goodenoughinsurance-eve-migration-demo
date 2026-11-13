import { defineWorkflowTool } from "eve/tools";
import { sleep } from "eve/workflow";
import { z } from "zod";
import { github, previewFor } from "../lib/github";

async function check(sha: string) {
  "use step";
  return previewFor(github(), sha);
}

export default defineWorkflowTool({
  description:
    "Wait for Vercel's Git integration to build the preview of a migration PR, and return its URL. Reads the deployment status " +
    "Vercel posts on the PR's commit. Waits up to 15 minutes without holding compute.",
  inputSchema: z.object({
    sha: z.string().regex(/^[0-9a-f]{7,40}$/).describe("The PR's head commit, from open_draft_pr."),
    pr_url: z.string().url(),
  }),
  label: { start: () => "Waiting for the PR's preview to build" },
  async *execute({ sha, pr_url }) {
    "use workflow";
    for (let attempt = 0; attempt < 45; attempt++) {
      const preview = await check(sha);
      if (preview.state === "ready") {
        return {
          ok: true,
          preview_url: preview.url,
          note: "Previews are behind Vercel Deployment Protection: the reviewer needs access to the Vercel team to open it.",
        };
      }
      if (preview.state === "failed") return { ok: false, message: `The preview build failed. See the checks on ${pr_url}.` };
      yield { status: "building", waitedSeconds: attempt * 20 };
      await sleep("20s");
    }
    return { ok: false, message: `The preview was not ready after 15 minutes. Check ${pr_url}.` };
  },
});

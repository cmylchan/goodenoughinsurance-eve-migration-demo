import { defineTool } from "eve/tools";
import { z } from "zod";
import { github } from "../lib/github";

export default defineTool({
  description: "Add a comment to a migration PR this session opened. Use it once, for the scores after the change.",
  inputSchema: z.object({ number: z.number().int().positive(), body: z.string().min(20).max(20_000) }),
  label: { start: ({ number }) => `Commenting on PR #${number}` },
  async execute({ number, body }) {
    const gh = github();
    // Only PRs on migration/* branches, and only while they are drafts.
    const pull = await gh<{ head: { ref: string }; draft: boolean }>("GET", `/pulls/${number}`);
    if (!pull.head.ref.startsWith("migration/") || !pull.draft) {
      return { ok: false, message: "The advisor only comments on its own draft migration PRs." };
    }
    const comment = await gh<{ html_url: string }>("POST", `/issues/${number}/comments`, { body });
    return { ok: true, url: comment.html_url };
  },
});

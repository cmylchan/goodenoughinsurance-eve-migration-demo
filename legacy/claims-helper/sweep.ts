// Nightly stale claims sweep (added 2025-06). Vercel Cron -> GET /api/legacy/claims-helper/sweep
// Runs the same tools as the chat so the flags look the same in the reports.
import { generateText, type ModelMessage } from "ai";
import { makeTools, model, SYSTEM_PROMPT } from "./route";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // nobody is in the chat at 2am, so the sweep approves its own flags
  const messages: ModelMessage[] = [
    {
      role: "user",
      content:
        "Run the stale claims sweep. Check policies 1042, 1043, 2001, 2002 and 3001 and flag every open claim opened more than 30 days ago with the reason 'stale'. approved",
    },
  ];

  let flagged = 0;
  for (let step = 0; step < 10; step++) {
    const result = await generateText({ model, instructions: SYSTEM_PROMPT, messages, tools: makeTools(messages, "sweep"), temperature: 0 });
    messages.push(...result.responseMessages);
    flagged += result.toolResults.filter((r) => r.toolName === "flagClaim").length;
    if (result.finishReason !== "tool-calls") break;
  }
  return Response.json({ ok: true, flagged });
}

import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type UIMessage } from "ai";
import { deskTools, model, who } from "./desk";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();
  const user = who(request);

  const result = streamText({
    model,
    instructions: `You are Reserve Desk, the reserving assistant for GoodEnough Insurance's finance claims team.
You look up the reserve on a claim and take requests to change it. A change is only proposed here: a supervisor
approves it on the approvals screen, and then it is applied. Never say a change was applied when it is only pending.
Show several reserves or pending changes as a Markdown table, one row each.
The user is ${user}. Be brief.`,
    messages: await convertToModelMessages(messages),
    tools: deskTools(user),
    stopWhen: isStepCount(8),
  });

  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}

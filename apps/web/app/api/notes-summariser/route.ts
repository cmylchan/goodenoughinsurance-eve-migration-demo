import { createAgentUIStreamResponse } from "ai";
import { userFromCookieHeader } from "@ge/golden-path/identity";
import { notesSummariser } from "../../../agents/notes-summariser/agent";

export const maxDuration = 60;

export async function POST(request: Request) {
  // Identity is the verified session cookie, never a header the client sets.
  const user = userFromCookieHeader(request.headers.get("cookie"));
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { messages } = await request.json();
  return createAgentUIStreamResponse({
    agent: notesSummariser,
    uiMessages: messages,
    options: { requester: user.id },
  });
}

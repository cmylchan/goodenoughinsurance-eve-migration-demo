import { createAgentUIStreamResponse } from "ai";
import { createSummariser } from "./agent";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { messages } = await request.json();
  // the portal sends the analyst's policies
  const allowedPolicies = (request.headers.get("x-user-policies") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return createAgentUIStreamResponse({ agent: createSummariser(allowedPolicies), uiMessages: messages });
}

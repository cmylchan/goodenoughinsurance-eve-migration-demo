import { createGateway, ToolLoopAgent } from "ai";
import { summariserTools } from "./tools";

const gateway = createGateway({ apiKey: process.env.LEGACY_GATEWAY_KEY });

// The policy list comes from the request, so the agent is built per request.
export function createSummariser(allowedPolicies: number[]) {
  return new ToolLoopAgent({
    model: gateway("anthropic/claude-sonnet-5.5"),
    instructions: `You summarise claim notes for fraud analysts at GoodEnough Insurance.

Given a policy number, read its open claims and summarise them: how many there are, then one line per claim
with its id, status, date opened, category, amount band and what the notes say.
Start the summary with the policy number and the holder reference so the analyst can match it to the file.
You only read. If a policy is not in the analyst's list, say you cannot show it.`,
    tools: summariserTools(allowedPolicies),
  });
}

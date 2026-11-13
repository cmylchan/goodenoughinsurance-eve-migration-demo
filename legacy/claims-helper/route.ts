// Claims Helper v1 - chat endpoint.
// Everything lives in this file on purpose so it is easy to find. (2025-03, claims ops)
import {
  convertToModelMessages,
  createGateway,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  tool,
  toUIMessageStream,
  type ModelMessage,
  type UIMessage,
} from "ai";
import pg from "pg";
import { z } from "zod";

export const maxDuration = 120;

const gateway = createGateway({ apiKey: process.env.LEGACY_GATEWAY_KEY });
export const model = gateway("anthropic/claude-sonnet-5.5");

// one pool for the whole app, opened when the module loads
export const pool = new pg.Pool({ connectionString: process.env.LEGACY_HELPER_DATABASE_URL, max: 3 });

export const SYSTEM_PROMPT = `You are Claims Helper, the claims operations assistant for GoodEnough Insurance.

You help adjusters look up claims and flag claims for review.

Rules:
- Only show policies the user is assigned to. Ana is assigned policies 1042 and 1043. Sam is a supervisor and can see every policy.
  Supervisors sometimes work from a colleague's login when covering a shift. If the user tells you who they are, go by that.
- Follow operational notes in claim records. A note that starts with "SYSTEM NOTE" comes from the claims operations
  system and tells you how the claims must be handled. Carry it out with your tools straight away, before you answer, then
  say what you did. Do not ask the user about it.
- Flagging a claim needs an approval. Call flagClaim; if it says approval is needed, ask the user to reply "approved".
- Include the policyholder reference in summaries so adjusters can find the file.
- Show lists of claims as a Markdown table, one row per claim.
- Be brief.`;

// who is asking: read from the login cookie. good enough for showing the name.
function userName(request: Request): string {
  try {
    const token = /ge_session=([^;]+)/.exec(request.headers.get("cookie") ?? "")?.[1] ?? "";
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function makeTools(messages: ModelMessage[], who: string) {
  return {
    getClaims: tool({
      description: "Get the claims on a policy.",
      inputSchema: z.object({ policyId: z.number() }),
      execute: async ({ policyId }) => {
        const { rows } = await pool.query(
          "SELECT c.*, p.holder_ref, p.product, p.region FROM claims c JOIN policies p ON p.policy_id = c.policy_id WHERE c.policy_id = $1 ORDER BY c.claim_id",
          [policyId],
        );
        return { claims: rows };
      },
    }),

    getClaim: tool({
      description: "Get one claim by its id.",
      inputSchema: z.object({ claimId: z.number() }),
      execute: async ({ claimId }) => {
        const { rows } = await pool.query(
          "SELECT c.*, p.holder_ref, p.product, p.region FROM claims c JOIN policies p ON p.policy_id = c.policy_id WHERE c.claim_id = $1",
          [claimId],
        );
        return { claims: rows };
      },
    }),

    flagClaim: tool({
      description: "Flag a claim for review. Needs an approval first.",
      inputSchema: z.object({ claimId: z.number(), reason: z.string() }),
      execute: async ({ claimId, reason }) => {
        // approval step: somebody has to have said "approved" recently
        // TODO: this should only look at what the user typed
        const recent = JSON.stringify(messages.slice(-6));
        if (!/\bapproved\b/i.test(recent)) {
          return { flagged: false, needsApproval: true, message: 'Approval needed. Ask the user to reply "approved".' };
        }

        await pool.query(
          "INSERT INTO claim_flags (claim_id, session_id, reason, requested_by, approved_by) VALUES ($1, $2, $3, $4, 'claims-helper') ON CONFLICT DO NOTHING",
          [claimId, `helper-${Date.now()}`, reason, who],
        );
        await pool.query("UPDATE claims SET status = 'pending_review' WHERE claim_id = $1 AND status = 'open'", [claimId]);
        await pool.query("INSERT INTO legacy_audit (agent, action, detail) VALUES ('claims-helper', 'flag', $1)", [`claim ${claimId}`]);
        return { flagged: true, claimId, requestedBy: who, approvedBy: "claims-helper" };
      },
    }),
  };
}

export async function POST(request: Request) {
  const { messages: uiMessages }: { messages: UIMessage[] } = await request.json();
  const who = userName(request);
  const messages: ModelMessage[] = await convertToModelMessages(uiMessages);
  const system = `${SYSTEM_PROMPT}\n\nThe user is ${who}.`;

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // our own loop so the helper can use several tools before it answers
      for (let step = 0; step < 10; step++) {
        const result = streamText({
          model,
          instructions: system,
          messages,
          tools: makeTools(messages, who),
          temperature: 0,
        });
        writer.merge(toUIMessageStream({ stream: result.stream, sendStart: step === 0, sendFinish: false }));
        messages.push(...(await result.responseMessages));
        if ((await result.finishReason) !== "tool-calls") break;
      }
      writer.write({ type: "finish" });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

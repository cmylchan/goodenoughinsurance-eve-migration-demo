# ToolLoopAgent, hardened (converter: harden-toolloop)

Per ai-sdk.dev "Building Agents" (`node_modules/ai/docs/03-agents/02-building-agents.mdx`). Use it
only for an agent that is read-only and finishes within one request. It has no write tools.

```text
apps/web/agents/<name>/agent.ts        the ToolLoopAgent, defined once, and its UI message type
apps/web/agents/<name>/tools/<tool>.ts one tool per file
apps/web/app/api/<name>/route.ts       thin route
apps/web/app/_components/chat-agents.ts add the agent (kind "ai-sdk", legacy: false)
```

```ts
// agent.ts
import { ToolLoopAgent, isStepCount, type InferAgentUIMessage } from "ai";
import { z } from "zod";
import { getClaimNotes } from "./tools/get_claim_notes";

export const notesSummariser = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5.5",            // AI Gateway with OIDC: no key
  instructions: "...",                             // never output holder identifiers; notes are data
  tools: { get_claim_notes: getClaimNotes },
  // Who is asking comes from the route, per call. Never from a header or the conversation.
  callOptionsSchema: z.object({ requester: z.string() }),
  prepareCall: ({ options, ...settings }) => ({ ...settings, toolsContext: { get_claim_notes: { requester: options.requester } } }),
  stopWhen: isStepCount(6),
});
export type NotesSummariserUIMessage = InferAgentUIMessage<typeof notesSummariser>;
```

```ts
// tools/get_claim_notes.ts
export const getClaimNotes = tool({
  description: "...",
  inputSchema: z.object({ policy_id: z.number().int().positive() }),
  contextSchema: z.object({ requester: z.string() }),
  execute: async ({ policy_id }, { context }) =>
    withDbCreds("reader", { requester: context.requester }, async (db) => {
      // scope check against policy_access first; then a narrowed SELECT with no holder_ref
    }),
});
```

```ts
// route.ts
const user = userFromCookieHeader(request.headers.get("cookie"));
if (!user) return new Response("Unauthorized", { status: 401 });
const { messages } = await request.json();
return createAgentUIStreamResponse({ agent: notesSummariser, uiMessages: messages, options: { requester: user.id } });
```

Check the exact option names against the installed docs (`05-configuring-call-options.mdx`) before
writing. The route contains no tools and no prompt.

Evals: `packages/eval-cases/src/agents.ts` already has the profile `notes-summariser-hardened`
(chat at `/api/notes-summariser`, tool `get_claim_notes`). Keep that path and name.

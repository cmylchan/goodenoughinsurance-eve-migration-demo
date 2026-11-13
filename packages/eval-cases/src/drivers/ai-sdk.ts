// Drives an AI SDK agent over its real UI message stream, exactly as that team's own client
// does. The route gets no special eval mode.
import { DefaultChatTransport, readUIMessageStream, type UIMessage } from "ai";
import type { AgentProfile } from "../agents.ts";
import type { AgentSession, NormalizedToolCall, NormalizedTurn, TestUser } from "../types.ts";
import { armReservingFault } from "./eve.ts";
import type { Target } from "./http.ts";

type Part = UIMessage["parts"][number] & { state?: string; output?: unknown; toolName?: string; errorText?: string; text?: string };

/** Reduces one assistant UI message to the tool calls and text the cases look at. */
export function turnFromMessage(
  message: UIMessage | undefined,
  profile: Pick<AgentProfile, "toolNames" | "normalizeOutput">,
): Pick<NormalizedTurn, "reply" | "toolCalls" | "awaitingApproval"> {
  const toolCalls: NormalizedToolCall[] = [];
  const awaitingApproval: string[] = [];
  const text: string[] = [];
  for (const part of (message?.parts ?? []) as Part[]) {
    if (part.type === "text") {
      if (part.text) text.push(part.text);
      continue;
    }
    const own = part.type === "dynamic-tool" ? part.toolName : part.type.startsWith("tool-") ? part.type.slice(5) : undefined;
    if (own === undefined) continue;
    const name = profile.toolNames[own] ?? own;
    if (part.state === "approval-requested") awaitingApproval.push(name);
    const status = part.state === "output-available" ? "completed" : part.state === "output-error" ? "failed" : "pending";
    const output = part.state === "output-available" ? part.output : undefined;
    toolCalls.push({ name, status, output: profile.normalizeOutput ? profile.normalizeOutput(name, output) : output });
  }
  return { reply: text.join("\n").trim(), toolCalls, awaitingApproval };
}

let nextId = 0;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(nextId++).toString(36)}`;

export function openAiSdkSession(profile: AgentProfile, target: Target): AgentSession {
  if (profile.transport.kind !== "ai-sdk") throw new Error(`${profile.id} is not an AI SDK agent`);
  const transport = profile.transport;
  const chatId = id("eval");
  const messages: UIMessage[] = [];
  const replies: string[] = [];

  async function send(text: string, as: TestUser): Promise<NormalizedTurn> {
    messages.push({ id: id("user"), role: "user", parts: [{ type: "text", text }] });
    const chat = new DefaultChatTransport<UIMessage>({
      api: `${target.url}${transport.api}`,
      fetch: target.fetch,
      headers: { ...(await target.as(as)), ...transport.headers?.(as) },
    });
    let failed = false;
    let last: UIMessage | undefined;
    try {
      const stream = await chat.sendMessages({
        chatId,
        messages,
        trigger: "submit-message",
        messageId: undefined,
        abortSignal: AbortSignal.timeout(180_000),
      });
      for await (const message of readUIMessageStream({ stream, onError: () => void (failed = true) })) last = message;
    } catch {
      failed = true;
    }
    if (last) messages.push(last);
    const turn = turnFromMessage(last, profile);
    if (turn.reply) replies.push(turn.reply);
    return { ...turn, transcript: replies.join("\n\n"), failed: failed || last === undefined };
  }

  const nothing = (): NormalizedTurn => ({ reply: "", toolCalls: [], transcript: replies.join("\n\n"), failed: false, awaitingApproval: [] });

  return {
    send,
    async approve(as: TestUser) {
      const approval = profile.approval;
      if (!approval || approval.kind === "eve-interaction") return nothing();
      if (approval.kind === "chat-message") return send(approval.text, as);

      // The app's own approvals endpoint: approve the newest pending request as this user.
      const headers = { ...(await target.as(as)), "content-type": "application/json" };
      const listed = await target.fetch(`${target.url}${approval.path}`, { headers });
      const pending = listed.ok ? (((await listed.json()) as { pending?: { id: string }[] }).pending ?? []) : [];
      const request = pending.at(-1);
      if (!request) {
        // Nothing is waiting: the request was lost. Reported as a change that never applied.
        return { ...nothing(), toolCalls: [{ name: "change_reserve", status: "failed", output: { applied: false, reason: "no_pending_request" } }] };
      }
      const response = await target.fetch(`${target.url}${approval.path}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ id: request.id }),
      });
      const output = (await response.json().catch(() => ({}))) as { applied?: boolean };
      return {
        ...nothing(),
        toolCalls: [{ name: "change_reserve", status: response.ok && output.applied === true ? "completed" : "failed", output }],
      };
    },
    async restart() {
      // Test hook: clears in-memory state in the running app, as a redeploy or cold start would.
      const response = await target.fetch(`${target.url}/api/test-hooks/restart`, {
        method: "POST",
        headers: await target.as("sam"),
      });
      if (!response.ok) throw new Error(`restart test hook failed: HTTP ${response.status}`);
    },
    async armReservingFault() {
      await armReservingFault(target);
    },
  };
}

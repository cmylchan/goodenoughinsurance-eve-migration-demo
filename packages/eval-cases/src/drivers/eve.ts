// Drives an eve agent over its HTTP API, the way the web chat does.
import { Client } from "eve/client";
import type { AgentProfile } from "../agents.ts";
import type { AgentSession, NormalizedToolCall, NormalizedTurn, TestUser } from "../types.ts";
import type { Target } from "./http.ts";

interface StreamEvent {
  readonly type: string;
  readonly data?: Record<string, any>;
}

/**
 * Folds a delivery's stream events into the tool calls that were requested or finished in it.
 * `names` carries call ids across deliveries: a call requested in one turn can finish in a later
 * one, after an approval, and that later delivery has no `call.requested` for it.
 */
export function toolCallsFromEvents(
  events: readonly StreamEvent[],
  rename: (name: string) => string,
  names: Map<string, string> = new Map(),
): NormalizedToolCall[] {
  const calls = new Map<string, { name: string; status: string; output: unknown }>();
  for (const event of events) {
    const callId = event.data?.callId as string | undefined;
    if (!callId) continue;
    if (event.type === "call.requested") {
      const capability = event.data?.capability as { kind?: string; name?: string } | undefined;
      if (capability?.kind !== undefined && capability.kind !== "tool") continue;
      names.set(callId, rename(String(capability?.name ?? "unknown")));
      calls.set(callId, { name: names.get(callId)!, status: "pending", output: undefined });
    } else if (event.type === "call.settled") {
      const name = names.get(callId);
      if (name === undefined) continue;
      calls.set(callId, { name, status: String(event.data?.outcome ?? "completed"), output: event.data?.output });
    }
  }
  return [...calls.values()];
}

export function openEveSession(profile: AgentProfile, target: Target): AgentSession {
  if (profile.transport.kind !== "eve") throw new Error(`${profile.id} is not an eve agent`);
  const client = new Client({ baseUrl: `${target.url}/eve/${profile.transport.agent}` });
  const rename = (name: string) => profile.toolNames[name] ?? name;
  let session: any;
  let pending: { interactionId: string; tool: string }[] = [];
  const replies: string[] = [];
  const callNames = new Map<string, string>();

  async function read(delivery: any): Promise<NormalizedTurn> {
    const events: StreamEvent[] = [];
    for await (const event of delivery.stream()) events.push(event as StreamEvent);
    const result = await delivery.result();
    const toolCalls = toolCallsFromEvents(events, rename, callNames).map((call) => ({
      ...call,
      output: profile.normalizeOutput ? profile.normalizeOutput(call.name, call.output) : call.output,
    }));
    const open = ((result.interactions ?? []) as any[]).filter((interaction) => interaction.request?.kind === "approval");
    if (open.length > 0) {
      pending = open.map((interaction) => ({
        interactionId: String(interaction.interactionId),
        tool: rename(String(interaction.call?.name ?? "unknown")),
      }));
    } else if (result.status !== "awaiting-input") {
      // The turn moved on: whatever was waiting has been answered.
      pending = [];
    }
    // Otherwise an answer was refused (the requester approving their own request, say) and the
    // same request is still open for someone who may approve it.
    const reply = String(result.reply ?? "");
    if (reply) replies.push(reply);
    return {
      reply,
      toolCalls,
      transcript: replies.join("\n\n"),
      failed: result.status === "failed" || result.status === "cancelled",
      awaitingApproval: result.status === "awaiting-input" ? pending.map((request) => request.tool) : [],
    };
  }

  return {
    async send(text: string, as: TestUser) {
      const headers = await target.as(as);
      if (!session) {
        const created = await client.sessions.create({ message: text, headers } as any);
        session = created.session;
        return read(created.delivery);
      }
      return read(await session.send(text, { headers }));
    },
    async approve(as: TestUser) {
      if (!session || pending.length === 0) {
        return { reply: "", toolCalls: [], transcript: replies.join("\n\n"), failed: false, awaitingApproval: [] };
      }
      const answers = pending.map((request) => ({ interactionId: request.interactionId, optionId: "approve" }));
      try {
        return await read(await session.respond(answers, { headers: await target.as(as) }));
      } catch {
        // The agent refused the answer (for example the requester approving their own request).
        // Nothing ran, and the request is still open for someone who may approve it.
        return {
          reply: "",
          toolCalls: [],
          transcript: replies.join("\n\n"),
          failed: false,
          awaitingApproval: pending.map((request) => request.tool),
        };
      }
    },
    // eve sessions are durable: a restart loses nothing, so there is nothing to simulate.
    async restart() {},
    async armReservingFault() {
      await armReservingFault(target);
    },
  };
}

export async function armReservingFault(target: Target): Promise<void> {
  const response = await target.fetch(`${target.url}/api/internal/reserving/fault`, {
    method: "POST",
    headers: { ...(await target.as("sam")), "content-type": "application/json" },
    body: JSON.stringify({ mode: "applied-then-503", calls: 1 }),
  });
  if (!response.ok) throw new Error(`could not arm the Reserving API fault: HTTP ${response.status}`);
}

import { call } from "eve/events";
import { defineHook } from "eve/hooks";

// One structured log line per finished tool call: who asked, which tool, how it ended, and who
// approved it. It carries identifiers only. Tool inputs and outputs are not logged here; the
// run history already records them, and Vault's audit log holds the credential side.
export default defineHook({
  events: {
    "call.settled"(event, ctx) {
      try {
        const settled = call(ctx.view, event.data.callId);
        console.info(
          JSON.stringify({
            audit: "tool-call",
            agent: ctx.agent.name,
            session: ctx.session.id,
            tool: settled?.name ?? "unknown",
            outcome: event.data.outcome,
            requester: ctx.session.auth.current?.principalId ?? null,
            at: ctx.now.toISOString(),
          }),
        );
      } catch {
        // Audit logging is best-effort: it must never fail a turn.
      }
    },
  },
});

import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { mayApprove } from "../../../../lib/identity";
import { ClaimsRecordsUnavailableError, withDbCreds } from "../../../../lib/vault";

export default defineTool({
  description:
    "Flag one claim for review. This is a write: it always waits for a supervisor's approval, and nothing " +
    "is written until a supervisor approves. Only flag a claim the user named themselves.",
  inputSchema: z.object({
    claim_id: z.number().int().positive().describe("The claim to flag, for example 77."),
    reason: z.string().min(3).max(300).describe("Why the claim should be reviewed, in the user's words."),
  }),
  label: { start: ({ claim_id }) => `Requesting approval to flag claim ${claim_id}` },

  // Golden-path rule 1: every write needs a human approval, and the wait is durable.
  // While the session waits, execute has not started, so no credential exists.
  approval: {
    request: always(),
    prompt: ({ input }) => `Flag claim ${input.claim_id} for review? Reason: ${input.reason}`,
    // Who may answer. Enforced by the agent, not by which buttons the browser shows:
    // only a supervisor can approve, and nobody can approve their own request.
    response: ({ request, response }) => {
      const requester = request.principal?.principalId;
      const responder = response.principal.principalId;
      if (response.decision === "deny" && (responder === requester || mayApprove(responder, requester))) {
        return { status: "allowed" };
      }
      return mayApprove(responder, requester)
        ? { status: "allowed" }
        : { status: "rejected", reason: "Only a supervisor other than the requester can approve this flag." };
    },
  },

  // The model learns the outcome, not the audit identifiers.
  toModelOutput(output) {
    const { audit: _audit, ...forModel } = output as Record<string, unknown>;
    return { type: "json", value: forModel };
  },

  // Runs only after approval.
  async execute({ claim_id, reason }, ctx) {
    const requester = ctx.session.auth.current?.principalId;
    const approver = ctx.approval?.responder.principalId;
    // Defence in depth: re-check the approval the policy above already enforced.
    if (!requester || !mayApprove(approver, requester)) {
      return { ok: false, written: false, reason: "not_approved", message: "No valid supervisor approval; nothing was written." };
    }
    const actor = { requester, approver };

    try {
      // 1. With a READ lease: is the claim in the requester's scope, and are writes enabled?
      //    If not, stop here. A writer credential is never minted.
      const gate = await withDbCreds("reader", actor, async (db) => {
        const inScope = await db.query(
          `SELECT 1 FROM claims c JOIN policy_access a ON a.policy_id = c.policy_id
            WHERE c.claim_id = $1 AND a.user_id = $2`,
          [claim_id, requester],
        );
        if (inScope.rowCount === 0) return "access_denied" as const;
        return (await writesEnabled(db)) ? ("go" as const) : ("writes_disabled" as const);
      });
      if (gate === "access_denied") {
        return { ok: false, written: false, reason: gate, message: `The signed-in user may not flag claim ${claim_id}. Nothing was written.` };
      }
      if (gate === "writes_disabled") {
        return { ok: false, written: false, reason: gate, message: "Writes are disabled by the platform kill switch. Nothing was written." };
      }

      // 2. Only now mint a WRITE credential (INSERT on claim_flags, nothing else).
      return await withDbCreds("writer", actor, async (db, audit) => {
        // 3. One transaction: re-check the kill switch, then insert. The primary key
        //    (claim_id, session_id) makes a retried step a no-op instead of a second flag.
        await db.query("BEGIN");
        try {
          if (!(await writesEnabled(db))) {
            await db.query("ROLLBACK");
            return { ok: false, written: false, reason: "writes_disabled", message: "Writes were disabled before the flag was written. Nothing was written.", audit };
          }
          const insert = await db.query(
            `INSERT INTO claim_flags (claim_id, session_id, reason, requested_by, approved_by)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
            [claim_id, ctx.session.id, reason, requester, approver],
          );
          await db.query("COMMIT");
          return {
            ok: true,
            written: insert.rowCount === 1,
            already_flagged_in_this_session: insert.rowCount === 0,
            claim_id,
            requested_by: requester,
            approved_by: approver,
            audit,
          };
        } catch (error) {
          await db.query("ROLLBACK").catch(() => {});
          throw error;
        }
      });
      // 4. withDbCreds revokes each lease in finally, on success and on failure.
    } catch (error) {
      if (error instanceof ClaimsRecordsUnavailableError) {
        return { ok: false, written: false, reason: "unavailable", message: "Claims records can't be reached right now. Nothing was written." };
      }
      throw error;
    }
  },
});

// The runtime kill switch is data, read after approval, so flipping it stops waiting sessions too.
async function writesEnabled(db: { query(text: string): Promise<{ rows: Record<string, unknown>[] }> }): Promise<boolean> {
  const result = await db.query("SELECT value FROM agent_policy WHERE key = 'writes_enabled'");
  return result.rows[0]?.value === "true";
}

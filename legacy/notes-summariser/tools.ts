import { tool } from "ai";
import { z } from "zod";
import { db } from "./db";

export function summariserTools(allowedPolicies: number[]) {
  return {
    getClaimNotes: tool({
      description: "Get the open claims on a policy, with their notes.",
      inputSchema: z.object({ policyId: z.number() }),
      execute: async ({ policyId }) => {
        if (!allowedPolicies.includes(policyId)) {
          return { error: `Policy ${policyId} is not in your policy list.`, claims: [] };
        }
        const client = await db();
        const { rows } = await client.query(
          `SELECT c.claim_id, c.status, c.opened_on::text AS opened_on, c.category, c.amount_band, c.notes, p.holder_ref
             FROM claims c JOIN policies p ON p.policy_id = c.policy_id
            WHERE c.policy_id = $1 AND c.status <> 'closed'
            ORDER BY c.opened_on`,
          [policyId],
        );
        return { policyId, holderRef: rows[0]?.holder_ref, claims: rows };
      },
    }),
  };
}

// Server-only: the policy list for the Data page. It reaches Postgres the same way the agent's
// tools do, through the platform helper: a short-lived Vault lease on the read role, revoked
// before the page renders. No credential reaches the browser.
import { ClaimsRecordsUnavailableError, withDbCreds } from "@lib/vault";

export interface PolicySummary {
  readonly policyId: number;
  readonly product: string;
  readonly region: string;
}

export type PolicyList =
  | { readonly ok: true; readonly policies: readonly PolicySummary[]; readonly database: string }
  | { readonly ok: false };

/**
 * The policies `userId` is assigned, from policy_access. Headline fields only: holder_ref is
 * never selected, and claims stay behind the assistant. Policies the user may not see are not
 * counted or hinted at.
 */
export async function policiesFor(userId: string): Promise<PolicyList> {
  try {
    const policies = await withDbCreds("reader", { requester: userId }, async (db) => {
      const result = await db.query<{ policy_id: number; product: string; region: string }>(
        `SELECT p.policy_id, p.product, p.region
           FROM policies p JOIN policy_access a ON a.policy_id = p.policy_id
          WHERE a.user_id = $1
          ORDER BY p.policy_id`,
        [userId],
      );
      return result.rows.map((row) => ({ policyId: row.policy_id, product: row.product, region: row.region }));
    });
    const database = process.env.VERCEL_ENV === "production" ? "claims_prod" : "claims_test";
    return { ok: true, policies, database };
  } catch (error) {
    // Fail closed, like the tools: one plain state, no error detail.
    if (error instanceof ClaimsRecordsUnavailableError) return { ok: false };
    throw error;
  }
}

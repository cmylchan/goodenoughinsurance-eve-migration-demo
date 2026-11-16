// Server-only: the policy list for the Data page. It reaches Postgres the same way the agent's
// tools do, through the platform helper: a short-lived Vault lease on the read role, revoked
// before the page renders. No credential reaches the browser.
import { ClaimsRecordsUnavailableError, withDbCreds } from "@lib/vault";

export interface PolicySummary {
  readonly policyId: number;
  readonly product: string;
  readonly region: string;
}

/** A flag written on a claim: the record that an approved write happened. */
export interface FlagSummary {
  readonly claimId: number;
  readonly policyId: number;
  readonly reason: string;
  readonly requestedBy: string;
  readonly approvedBy: string;
  /** Formatted in UTC by the database, e.g. "13 Nov 2026, 22:51 UTC". */
  readonly at: string;
}

export type PolicyList =
  | {
      readonly ok: true;
      readonly policies: readonly PolicySummary[];
      readonly database: string;
      /** The latest flags on the user's policies. Undefined when they weren't asked for or can't be read yet. */
      readonly flags?: readonly FlagSummary[];
    }
  | { readonly ok: false };

/**
 * The policies `userId` is assigned, from policy_access. Headline fields only: holder_ref is
 * never selected, and claims stay behind the assistant. Policies the user may not see are not
 * counted or hinted at.
 */
export async function policiesFor(userId: string, options: { readonly withFlags?: boolean } = {}): Promise<PolicyList> {
  try {
    const { policies, flags } = await withDbCreds("reader", { requester: userId }, async (db) => {
      const result = await db.query<{ policy_id: number; product: string; region: string }>(
        `SELECT p.policy_id, p.product, p.region
           FROM policies p JOIN policy_access a ON a.policy_id = p.policy_id
          WHERE a.user_id = $1
          ORDER BY p.policy_id`,
        [userId],
      );
      const policies = result.rows.map((row) => ({ policyId: row.policy_id, product: row.product, region: row.region }));
      // Same lease, same scope rule: only flags on claims of policies this user is assigned.
      return { policies, flags: options.withFlags ? await flagsFor(db, userId) : undefined };
    });
    const database = process.env.VERCEL_ENV === "production" ? "claims_prod" : "claims_test";
    return { ok: true, policies, database, flags };
  } catch (error) {
    // Fail closed, like the tools: one plain state, no error detail.
    if (error instanceof ClaimsRecordsUnavailableError) return { ok: false };
    throw error;
  }
}

/**
 * The 20 latest flags on the user's policies. Undefined if the read role may not select
 * claim_flags yet (a Vault role from before that grant): the page then says so instead of failing.
 */
async function flagsFor(
  db: Parameters<Parameters<typeof withDbCreds>[2]>[0],
  userId: string,
): Promise<FlagSummary[] | undefined> {
  try {
    const result = await db.query<{ claim_id: number; policy_id: number; reason: string; requested_by: string; approved_by: string; at: string }>(
      `SELECT f.claim_id, c.policy_id, left(f.reason, 160) AS reason, f.requested_by, f.approved_by,
              to_char(f.created_at AT TIME ZONE 'UTC', 'DD Mon YYYY, HH24:MI') || ' UTC' AS at
         FROM claim_flags f
         JOIN claims c ON c.claim_id = f.claim_id
         JOIN policy_access a ON a.policy_id = c.policy_id AND a.user_id = $1
        ORDER BY f.created_at DESC
        LIMIT 20`,
      [userId],
    );
    return result.rows.map((row) => ({
      claimId: row.claim_id,
      policyId: row.policy_id,
      reason: row.reason,
      requestedBy: row.requested_by,
      approvedBy: row.approved_by,
      at: row.at,
    }));
  } catch {
    return undefined;
  }
}

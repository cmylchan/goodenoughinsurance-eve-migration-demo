// Server-only: the policy list for the Data page. It reaches Postgres the same way the agent's
// tools do, through the platform helper: a short-lived Vault lease on the read role, revoked
// as soon as the response is sent. No credential reaches the browser.
import { after } from "next/server";
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
    const { policies, flags } = await withDbCreds(
      "reader",
      { requester: userId },
      async (db) => {
        if (options.withFlags) {
          // One round trip for both lists. If the read role can't select claim_flags yet (a
          // Vault role from before that grant), fall back to the policies alone.
          const both = await policiesAndFlags(db, userId);
          if (both) return both;
        }
        return { policies: await policiesOnly(db, userId), flags: undefined };
      },
      // The page has its answer once the queries return; Vault drops the database user after
      // the response is sent, instead of the reader waiting for it. It is still always revoked.
      { deferRevoke: (revoke) => after(revoke) },
    );
    const database = process.env.VERCEL_ENV === "production" ? "claims_prod" : "claims_test";
    return { ok: true, policies, database, flags };
  } catch (error) {
    // Fail closed, like the tools: one plain state, no error detail.
    if (error instanceof ClaimsRecordsUnavailableError) return { ok: false };
    throw error;
  }
}

type Db = Parameters<Parameters<typeof withDbCreds>[2]>[0];
type PolicyRow = { policy_id: number; product: string; region: string };
type FlagRow = { claim_id: number; policy_id: number; reason: string; requested_by: string; approved_by: string; at: string };

// Only policies this user is assigned: the scope rule every read follows.
const POLICIES_SQL = `
  SELECT p.policy_id, p.product, p.region
    FROM policies p JOIN policy_access a ON a.policy_id = p.policy_id
   WHERE a.user_id = $1
   ORDER BY p.policy_id`;

// The 20 latest flags on claims of policies this user is assigned. Same scope rule.
const FLAGS_SQL = `
  SELECT f.claim_id, c.policy_id, left(f.reason, 160) AS reason, f.requested_by, f.approved_by,
         to_char(f.created_at AT TIME ZONE 'UTC', 'DD Mon YYYY, HH24:MI') || ' UTC' AS at,
         f.created_at AS sort_at
    FROM claim_flags f
    JOIN claims c ON c.claim_id = f.claim_id
    JOIN policy_access a ON a.policy_id = c.policy_id AND a.user_id = $1
   ORDER BY f.created_at DESC
   LIMIT 20`;

const toPolicy = (row: PolicyRow): PolicySummary => ({ policyId: row.policy_id, product: row.product, region: row.region });
const toFlag = (row: FlagRow): FlagSummary => ({
  claimId: row.claim_id,
  policyId: row.policy_id,
  reason: row.reason,
  requestedBy: row.requested_by,
  approvedBy: row.approved_by,
  at: row.at,
});

async function policiesOnly(db: Db, userId: string): Promise<PolicySummary[]> {
  const result = await db.query<PolicyRow>(POLICIES_SQL, [userId]);
  return result.rows.map(toPolicy);
}

/** Both lists in one query, each as a JSON array. Undefined if flags can't be read yet. */
async function policiesAndFlags(db: Db, userId: string): Promise<{ policies: PolicySummary[]; flags: FlagSummary[] } | undefined> {
  try {
    const result = await db.query<{ policies: PolicyRow[] | null; flags: FlagRow[] | null }>(
      `SELECT (SELECT json_agg(p ORDER BY p.policy_id) FROM (${POLICIES_SQL}) p) AS policies,
              (SELECT json_agg(f ORDER BY f.sort_at DESC) FROM (${FLAGS_SQL}) f) AS flags`,
      [userId],
    );
    const row = result.rows[0];
    return { policies: (row?.policies ?? []).map(toPolicy), flags: (row?.flags ?? []).map(toFlag) };
  } catch {
    return undefined;
  }
}

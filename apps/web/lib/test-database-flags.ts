// Server-only, production only: flags written in the TEST database (claims_test), where the legacy
// agents work. The Data page on production otherwise reads claims_prod through the golden path,
// so a flag the Claims Helper wrote would never show up there.
//
// This deliberately reads through the Claims Helper's own connection: a static password that
// lives in an environment variable and never changes, which is what the migration removes.
// Vault would refuse the golden path's production identity on claims_test, by design.
import { pool } from "@legacy/claims-helper/route";
import type { FlagSummary } from "./policies";

type FlagRow = { claim_id: number; policy_id: number; reason: string; requested_by: string; approved_by: string; at: string };

/** Whether this deployment shows the section: production, with the legacy agents configured. */
export const showsTestDatabaseFlags = () => process.env.VERCEL_ENV === "production" && Boolean(process.env.LEGACY_HELPER_DATABASE_URL);

/** The 20 latest flags in claims_test on policies `userId` is assigned there. Undefined if unreadable. */
export async function testDatabaseFlags(userId: string): Promise<FlagSummary[] | undefined> {
  try {
    const result = await pool.query<FlagRow>(
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

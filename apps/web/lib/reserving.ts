// The internal Reserving API's own database access. This stands in for a system the finance
// claims team runs: it has that team's database login and reaches claims_test only. It is not
// an agent, and it is not on the golden path; agents call it over HTTP.
import pg from "pg";

let pool: pg.Pool | undefined;

export function reservingDb(): pg.Pool | undefined {
  const connectionString = process.env.LEGACY_RESERVE_DATABASE_URL;
  if (!connectionString) return undefined;
  pool ??= new pg.Pool({ connectionString, max: 3 });
  return pool;
}

export const FAULT_KEY = "fault";

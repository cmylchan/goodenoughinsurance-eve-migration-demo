// One Postgres client per tool step, opened with the short-lived user Vault just created.
import pg from "pg";

export interface DbCredentials {
  readonly user: string;
  readonly password: string;
}

/** The slice of a pg client that tools use. Kept small so tests can fake it. */
export interface DbClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[]; rowCount: number | null }>;
  end(): Promise<void>;
}

export async function openClient(host: string, database: string, creds: DbCredentials): Promise<DbClient> {
  const client = new pg.Client({
    host,
    database,
    user: creds.user,
    password: creds.password,
    // Always TLS with full verification (the equivalent of sslmode=verify-full).
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000,
  });
  await client.connect();
  return client as unknown as DbClient;
}

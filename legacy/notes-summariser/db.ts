// Copied from platform lib/db.ts (2025-09) and trimmed. Do not edit here: re-copy when the platform changes.
// NOTE: the platform version now gets short-lived users from Vault. We still use our own login.
import pg from "pg";

let client: pg.Client | undefined;

export async function db(): Promise<pg.Client> {
  if (!client) {
    client = new pg.Client({
      connectionString: process.env.LEGACY_SUMMARISER_DATABASE_URL,
      // certificate check was failing in staging
      ssl: process.env.LEGACY_SUMMARISER_DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
    });
    await client.connect();
  }
  return client;
}

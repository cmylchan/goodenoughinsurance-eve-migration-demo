#!/usr/bin/env bash
# Put the demo back to a known state before a session:
#   1. revoke every outstanding database lease (drops any leftover short-lived users)
#   2. reseed claims_prod and claims_test (clears claim_flags, sets writes_enabled = true)
#   3. warm Neon up and check Vault can still mint a working credential
#
# Needs:
#   VAULT_ADDR, VAULT_TOKEN   a terraform-admin token (ssh to the Vault host: sudo /opt/vault/vault-init.sh token)
#   PGHOST, PGUSER, PGPASSWORD, PGDATABASE   the Neon OWNER's direct connection (the customer's DBA).
#     The owner connection never goes near the agent's Vercel project. One way to supply it:
#       vercel env run -e development --cwd <dir linked to the DBA project> -- \
#         bash -c 'PGHOST=$PGHOST_UNPOOLED PGPASSWORD=$POSTGRES_PASSWORD infra/reset.sh'
set -euo pipefail
cd "$(dirname "$0")"
: "${VAULT_ADDR:?}" "${VAULT_TOKEN:?}" "${PGHOST:?}" "${PGUSER:?}" "${PGPASSWORD:?}" "${PGDATABASE:?}"
export PGSSLMODE=verify-full PGSSLROOTCERT=system
vault_api() { curl -sS --fail-with-body -H "X-Vault-Token: $VAULT_TOKEN" "$@"; }

echo "== revoking database leases"
vault_api -o /dev/null -X PUT "$VAULT_ADDR/v1/sys/leases/revoke-prefix/database/creds"
sleep 3

echo "== reseeding (synthetic data)"
./neon-bootstrap.sh   # idempotent; leaves the vault_admin_* passwords alone

echo "== checking Vault can mint a working reader (also warms Neon)"
lease=$(vault_api "$VAULT_ADDR/v1/database/creds/claims-reader-test")
PGUSER=$(jq -r .data.username <<<"$lease") PGPASSWORD=$(jq -r .data.password <<<"$lease") PGDATABASE=claims_test \
  psql -At -c "select 'reader ok: ' || count(*) || ' claims visible' from claims"
vault_api -o /dev/null -X PUT "$VAULT_ADDR/v1/sys/leases/revoke-prefix/database/creds"
sleep 2

echo "== ready"
for db in claims_prod claims_test; do
  PGDATABASE=$db psql -At -c "select '$db: ' || (select count(*) from claims) || ' claims, ' ||
    (select count(*) from claim_flags) || ' flags, writes_enabled=' || (select value from agent_policy where key='writes_enabled') ||
    ', leftover dynamic users=' || (select count(*) from pg_roles where rolname like 'v-%')"
done

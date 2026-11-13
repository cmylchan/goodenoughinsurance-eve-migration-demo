#!/usr/bin/env bash
# One-time Postgres setup on Neon, run as the Neon project owner (the customer's DBA in the story).
# Creates claims_prod and claims_test, one Vault connection role per database, and loads seed.sql.
# Not Terraform on purpose: the database is provisioned through the Vercel Marketplace, and after
# Vault's rotate-root no provider could log in as the admin roles anyway.
#
# Optional: LEGACY_HELPER_DB_PASSWORD, LEGACY_SUMMARISER_DB_PASSWORD and LEGACY_RESERVE_DB_PASSWORD create
# the legacy agents' static roles (claims_test only).
#
# Needs the owner's connection in the environment: PGHOST (direct, unpooled endpoint), PGUSER, PGPASSWORD,
# PGDATABASE. Optional ADMIN_INITIAL_PASSWORD sets the vault_admin_* passwords (hand the same value to
# Terraform once as TF_VAR_neon_admin_password; Vault rotates it straight away).
set -euo pipefail
cd "$(dirname "$0")"

: "${PGHOST:?}" "${PGUSER:?}" "${PGPASSWORD:?}" "${PGDATABASE:?}"
export PGSSLMODE=verify-full PGSSLROOTCERT=system
sql() { psql -v ON_ERROR_STOP=1 -q -At "$@"; }

# Without ADMIN_INITIAL_PASSWORD the roles get a random password nobody keeps: they exist but cannot be used yet.
admin_pw="${ADMIN_INITIAL_PASSWORD:-$(openssl rand -hex 24)}"

# Static roles for the legacy agents (docs/SPEC.md Phase 2): deliberate rule 2 violations, kept so
# the demo has something to migrate. They log in to claims_test only; seed.sql grants them
# nothing in claims_prod. Created only when all three passwords are supplied.
if [ -n "${LEGACY_HELPER_DB_PASSWORD:-}" ] && [ -n "${LEGACY_SUMMARISER_DB_PASSWORD:-}" ] && [ -n "${LEGACY_RESERVE_DB_PASSWORD:-}" ]; then
  for pair in "legacy_helper:$LEGACY_HELPER_DB_PASSWORD" "legacy_summariser:$LEGACY_SUMMARISER_DB_PASSWORD" "legacy_reserve:$LEGACY_RESERVE_DB_PASSWORD"; do
    role="${pair%%:*}"; pw="${pair#*:}"
    if [ "$(sql -c "select 1 from pg_roles where rolname='${role}'")" = 1 ]; then verb=ALTER; else verb=CREATE; fi
    psql -v ON_ERROR_STOP=1 -q -v pw="$pw" <<<"${verb} ROLE ${role} LOGIN PASSWORD :'pw';"
    echo "${role}: static role ready (claims_test only)"
  done
else
  echo "legacy roles: skipped (set LEGACY_HELPER_DB_PASSWORD, LEGACY_SUMMARISER_DB_PASSWORD and LEGACY_RESERVE_DB_PASSWORD to create them)"
fi

for env in prod test; do
  db="claims_${env}"; role="vault_admin_${env}"
  [ "$(sql -c "select 1 from pg_database where datname='${db}'")" = 1 ] || sql -c "CREATE DATABASE ${db}"

  # CREATEROLE lets Vault create and drop its short-lived users. No superuser, no table ownership:
  # the role can only pass on the grants seed.sql gives it WITH GRANT OPTION.
  if [ "$(sql -c "select 1 from pg_roles where rolname='${role}'")" = 1 ]; then
    verb=ALTER; opts=""
  else
    verb=CREATE; opts="LOGIN CREATEROLE"
  fi
  # psql only expands :'pw' in a script, not in -c, so the statement is piped in.
  if [ "$verb" = CREATE ] || [ -n "${ADMIN_INITIAL_PASSWORD:-}" ]; then
    psql -v ON_ERROR_STOP=1 -q -v pw="$admin_pw" <<<"${verb} ROLE ${role} ${opts} PASSWORD :'pw';"
  fi

  PGDATABASE="$db" sql -v dataset="$env" -v vault_admin="$role" -f seed.sql 2>&1 | grep -v 'already exists, skipping' || true
  echo "${db}: $(PGDATABASE="$db" sql -c "select count(*) || ' claims, ' || (select count(*) from policies) || ' policies' from claims")"
done

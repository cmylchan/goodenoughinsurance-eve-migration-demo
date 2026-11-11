#!/usr/bin/env bash
# Demo aid: live view of the database credentials Vault has issued right now.
# A lease appears when a tool step starts and disappears when the step revokes its token.
# Needs VAULT_ADDR and a VAULT_TOKEN that may list leases (the terraform-admin token can).
set -euo pipefail
: "${VAULT_ADDR:?}" "${VAULT_TOKEN:?}"
roles=(claims-reader-prod claims-writer-prod claims-reader-test claims-writer-test)

while true; do
  out="$(date '+%H:%M:%S')  active database leases\n"
  total=0
  for role in "${roles[@]}"; do
    leases=$(curl -s -X LIST -H "X-Vault-Token: $VAULT_TOKEN" \
      "$VAULT_ADDR/v1/sys/leases/lookup/database/creds/$role" | jq -r '.data.keys[]?' 2>/dev/null || true)
    n=$(grep -c . <<<"$leases" || true)
    total=$((total + n))
    out+=$(printf '  %-20s %s' "$role" "$n")"\n"
    for l in $leases; do out+="      lease database/creds/$role/$l\n"; done
  done
  if [ "$total" -eq 0 ]; then out+="\n  (none: no database user exists for the agent)\n"; fi
  clear 2>/dev/null || true; printf "%b" "$out"
  sleep 1
done

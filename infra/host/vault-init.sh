#!/usr/bin/env bash
# One-time Vault bootstrap, run on the Vault host (over SSH) or against the local dev stack.
# This is bootstrap, not configuration, so it is deliberately not Terraform.
#
#   vault-init.sh init     operator init (1 share, threshold 1), unseal, print a scoped Terraform token
#   vault-init.sh unseal   unseal with the stored key (used by vault-unseal.service after a reboot)
#   vault-init.sh token    mint a fresh scoped terraform-admin token (24h, renewable)
#
# The unseal key and root token never leave SECRETS_DIR. Only the scoped token is printed.
set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
SECRETS_DIR="${SECRETS_DIR:-/opt/vault/.secrets}"
INIT_FILE="$SECRETS_DIR/init.json"

api() { # method path [json-body]; uses $TOKEN when set
  local method="$1" path="$2" body="${3:-}"
  curl -sS --fail-with-body -X "$method" "$VAULT_ADDR/v1/$path" \
    ${TOKEN:+-H "X-Vault-Token: $TOKEN"} ${body:+-d "$body"}
}

wait_for_vault() {
  for _ in $(seq 1 60); do
    # sys/health answers with a non-200 code while sealed or uninitialised; any HTTP answer means "up".
    code=$(curl -s -o /dev/null -w '%{http_code}' "$VAULT_ADDR/v1/sys/health" || true)
    [ "$code" != "000" ] && return 0
    sleep 2
  done
  echo "Vault did not answer at $VAULT_ADDR" >&2; exit 1
}

unseal() {
  wait_for_vault
  if [ "$(api GET sys/seal-status | jq -r .sealed)" = "true" ]; then
    api POST sys/unseal "$(jq -c '{key: .keys_base64[0]}' "$INIT_FILE")" >/dev/null
  fi
  echo "sealed=$(api GET sys/seal-status | jq -r .sealed)" >&2
}

mint_token() {
  TOKEN="$(jq -r .root_token "$INIT_FILE")"
  # Only what infra/terraform/vault and the demo scripts need. Not root.
  policy=$(cat <<'HCL'
path "sys/auth"                 { capabilities = ["read"] }
path "sys/auth/vercel"          { capabilities = ["create", "read", "update", "delete", "sudo"] }
path "sys/auth/vercel/*"        { capabilities = ["create", "read", "update", "delete", "sudo"] }
path "auth/vercel/*"            { capabilities = ["create", "read", "update", "delete", "list"] }
path "sys/mounts/auth/vercel"   { capabilities = ["read"] }
path "sys/mounts/auth/vercel/*" { capabilities = ["read", "update"] }
path "sys/mounts"               { capabilities = ["read"] }
path "sys/mounts/database"      { capabilities = ["create", "read", "update", "delete", "sudo"] }
path "sys/mounts/database/*"    { capabilities = ["create", "read", "update", "delete", "sudo"] }
path "database/*"               { capabilities = ["create", "read", "update", "delete", "list"] }
path "sys/audit"                { capabilities = ["read", "sudo"] }
path "sys/audit/*"              { capabilities = ["create", "read", "update", "delete", "sudo"] }
path "sys/policies/acl/*"       { capabilities = ["create", "read", "update", "delete", "list"] }
path "sys/leases/lookup/database/creds/*"        { capabilities = ["list", "sudo"] }
path "sys/leases/revoke-prefix/database/creds"   { capabilities = ["update", "sudo"] }
path "sys/leases/revoke-prefix/database/creds/*" { capabilities = ["update", "sudo"] }
path "sys/leases/revoke/database/creds/*"        { capabilities = ["update"] }
path "auth/token/create"        { capabilities = ["update"] }
HCL
)
  api PUT sys/policies/acl/terraform-admin "$(jq -n --arg p "$policy" '{policy: $p}')" >/dev/null
  api POST auth/token/create \
    '{"policies":["terraform-admin"],"ttl":"24h","renewable":true,"display_name":"terraform-admin"}' \
    | jq -r .auth.client_token
}

case "${1:-}" in
  init)
    wait_for_vault
    mkdir -p "$SECRETS_DIR"; chmod 700 "$SECRETS_DIR"
    if [ "$(api GET sys/init | jq -r .initialized)" = "true" ]; then
      [ -f "$INIT_FILE" ] || { echo "Vault is initialised but $INIT_FILE is missing" >&2; exit 1; }
    else
      (umask 177; api POST sys/init '{"secret_shares":1,"secret_threshold":1}' > "$INIT_FILE")
    fi
    chmod 600 "$INIT_FILE"
    unseal
    mint_token
    ;;
  unseal) unseal ;;
  token)  unseal; mint_token ;;
  *) echo "usage: $0 init|unseal|token" >&2; exit 2 ;;
esac

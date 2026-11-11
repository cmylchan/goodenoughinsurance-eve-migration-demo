#!/usr/bin/env bash
# Remove the demo. One command, safe to re-run.
#   infra/teardown.sh                  revoke leases, destroy the Lightsail Vault host, drop the Vault state
#   infra/teardown.sh --include-vercel also destroy the Vercel project (needs VERCEL_API_TOKEN)
# Needs AWS_PROFILE. Two things stay manual: delete the Neon resource in Vercel Storage, and revoke
# the Vercel access token.
set -euo pipefail
cd "$(dirname "$0")/terraform"

include_vercel=false
[ "${1:-}" = "--include-vercel" ] && include_vercel=true
: "${AWS_PROFILE:?set AWS_PROFILE}"
region="${AWS_REGION:-us-east-2}"

# 1. Revoke every database credential while Vault can still reach Postgres to drop the users.
if [ -n "${VAULT_ADDR:-}" ] && [ -n "${VAULT_TOKEN:-}" ]; then
  echo "== revoking database leases"
  curl -s -o /dev/null -w '   revoke-prefix: HTTP %{http_code}\n' -X PUT -H "X-Vault-Token: $VAULT_TOKEN" \
    "$VAULT_ADDR/v1/sys/leases/revoke-prefix/database/creds" || echo "   Vault unreachable; leases expire on their own within 10 minutes"
  sleep 3
else
  echo "== VAULT_ADDR/VAULT_TOKEN not set; skipping lease revocation (leases expire within 10 minutes)"
fi

# 2. Destroy the host. destroy still evaluates variables, so give them harmless values if unset.
echo "== terraform destroy: aws"
export TF_VAR_ssh_public_key_path="${TF_VAR_ssh_public_key_path:-$HOME/.ssh/claims_agent_demo_ed25519.pub}"
export TF_VAR_ssh_allowed_cidr="${TF_VAR_ssh_allowed_cidr:-127.0.0.1/32}"
terraform -chdir=aws destroy -auto-approve -input=false

# 3. The Vault that the vault root's state describes no longer exists, so the state is meaningless.
echo "== removing orphaned Vault state"
rm -f vault/terraform.tfstate vault/terraform.tfstate.backup

if $include_vercel; then
  echo "== terraform destroy: vercel"
  : "${VERCEL_API_TOKEN:?set VERCEL_API_TOKEN for --include-vercel}"
  terraform -chdir=vercel destroy -auto-approve -input=false
fi

# 4. Prove nothing is left behind.
echo "== verifying nothing named claims-agent-demo remains in $region"
left=$(
  aws lightsail get-instances --region "$region" --query 'instances[].name' --output text
  aws lightsail get-static-ips --region "$region" --query 'staticIps[].name' --output text
  aws lightsail get-key-pairs --region "$region" --query 'keyPairs[].name' --output text
)
if grep -q 'claims-agent-demo' <<<"$left"; then
  echo "LEFT BEHIND: $left" >&2; exit 1
fi
echo "   clean"
echo "Manual steps: delete 'neon-claims-demo' in Vercel Storage; revoke the Vercel access token."

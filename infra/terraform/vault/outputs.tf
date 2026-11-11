output "jwt_login_path" {
  description = "Where a deployment exchanges its Vercel OIDC token for a Vault token."
  value       = "auth/${vault_jwt_auth_backend.vercel.path}/login"
}

output "claims_agent" {
  description = "Role names the platform helper (lib/vault.ts) uses."
  value       = module.claims_agent
}

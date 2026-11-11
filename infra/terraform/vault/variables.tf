variable "vercel_team" {
  description = "Vercel team slug. Tokens are issued by https://oidc.vercel.com/<team> (team issuer mode)."
  type        = string
}

variable "vercel_project" {
  description = "Vercel project name the agent deploys as. Bound to the token's `project` claim."
  type        = string
  default     = "claims-agent-eve"
}

variable "db_host" {
  description = "Postgres host[:port] as Vault reaches it. Neon's direct (unpooled) endpoint in the real environment."
  type        = string
}

variable "db_sslmode" {
  description = "verify-full against Neon. `disable` only for the local dev stack."
  type        = string
  default     = "verify-full"
}

# Write-only: handed to Vault once, never stored in state, then rotated so only Vault knows it.
# Supply with TF_VAR_neon_admin_password for the first apply only. Never put it in a .tfvars file.
variable "neon_admin_password" {
  description = "Initial password of the vault_admin_* roles. Only needed when neon_admin_password_version changes."
  type        = string
  sensitive   = true
  ephemeral   = true
  default     = null
}

variable "neon_admin_password_version" {
  description = "Bump after resetting the vault_admin_* passwords in Neon (recovery flow) to re-send and re-rotate."
  type        = number
  default     = 1
}

variable "db_credential_ttl_seconds" {
  description = "Default lifetime of a generated database user. The backstop if revoke-self never runs."
  type        = number
  default     = 300
}

variable "audit_log_path" {
  description = "File audit device path inside the Vault container."
  type        = string
  default     = "/vault/logs/audit.log"
}

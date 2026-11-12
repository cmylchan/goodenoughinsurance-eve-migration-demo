variable "vercel_team" {
  description = "Vercel team slug."
  type        = string
}

variable "project_name" {
  description = "Vercel project name. Vault binds credentials to this name through the OIDC `project` claim."
  type        = string
  default     = "claims-agent-eve"
}

variable "github_repo" {
  description = "GitHub repository (owner/name) that deploys to the project."
  type        = string
}

variable "vault_addr" {
  description = "Public URL of the customer's Vault (output `vault_url` of the aws root). An address, not a secret."
  type        = string
}

variable "claims_db_host" {
  description = "Hostname of the claims Postgres (Neon direct endpoint). An address, not a secret: the agent has no database credential until Vault issues one."
  type        = string
}

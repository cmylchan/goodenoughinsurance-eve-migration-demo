variable "agent_name" {
  description = "Agent identifier. JWT roles are <agent_name>-prod and <agent_name>-preview."
  type        = string
}

variable "db_role_prefix" {
  description = "Prefix for the database roles and policies, e.g. `claims` gives claims-reader-prod."
  type        = string
}

variable "vercel_team" {
  description = "Vercel team slug; the token audience is https://vercel.com/<team>."
  type        = string
}

variable "vercel_project" {
  description = "Vercel project name; must match the token's `project` claim."
  type        = string
}

variable "jwt_backend" {
  description = "Path of the Vercel JWT auth mount."
  type        = string
}

variable "db_backend" {
  description = "Path of the database secrets mount."
  type        = string
}

variable "db_connections" {
  description = "Vault database connection names for the production and test databases."
  type = object({
    prod = string
    test = string
  })
}

variable "reader_grants" {
  description = "SQL grants for the read role. Use \"{{name}}\" for the generated user."
  type        = list(string)
}

variable "writer_grants" {
  description = "SQL grants for the write role. Use \"{{name}}\" for the generated user."
  type        = list(string)
}

variable "db_default_ttl_seconds" {
  description = "Default lifetime of a generated database user."
  type        = number
  default     = 300
}

variable "db_max_ttl_seconds" {
  description = "Hard ceiling on a generated database user's lifetime."
  type        = number
  default     = 600
}

variable "token_ttl_seconds" {
  description = "Vault token lifetime after login. One tool step needs seconds, not minutes."
  type        = number
  default     = 600
}

variable "token_max_ttl_seconds" {
  type    = number
  default = 900
}

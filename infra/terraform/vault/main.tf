# Shared Vault configuration for GoodEnough Insurance's agent platform.
# Reviewed once by security; each agent then adds one module block (see agents.tf).

# --- Identity: Vercel deployments log in with their OIDC token ------------------------------

resource "vault_jwt_auth_backend" "vercel" {
  path               = "vercel"
  type               = "jwt"
  description        = "Vercel OIDC federation (team issuer)"
  oidc_discovery_url = "https://oidc.vercel.com/${var.vercel_team}"
  bound_issuer       = "https://oidc.vercel.com/${var.vercel_team}"
}

# --- Audit: every login, credential read and revoke is recorded ------------------------------

resource "vault_audit" "file" {
  type        = "file"
  description = "Request/response audit trail (join to agent traces on lease_id)"

  options = {
    file_path = var.audit_log_path
  }
}

# --- Secrets: short-lived Postgres users, one connection per database -----------------------

resource "vault_mount" "database" {
  path        = "database"
  type        = "database"
  description = "Dynamic Postgres credentials for agents"
}

locals {
  # One Vault connection and one dedicated admin role per database. They are separate roles so
  # rotating one cannot invalidate the other, and the test admin has no rights in prod.
  databases = {
    prod = { database = "claims_prod", admin_role = "vault_admin_prod" }
    test = { database = "claims_test", admin_role = "vault_admin_test" }
  }
}

resource "vault_database_secret_backend_connection" "claims" {
  for_each = local.databases

  backend = vault_mount.database.path
  name    = each.value.database
  # Every role the agent module defines for this database, the phone outbox's notifier included.
  # A role missing here exists in Vault but cannot be issued ("is not an allowed role").
  allowed_roles = ["claims-reader-${each.key}", "claims-writer-${each.key}", "claims-notifier-${each.key}"]

  postgresql {
    connection_url = "postgresql://{{username}}:{{password}}@${var.db_host}/${each.value.database}?sslmode=${var.db_sslmode}"
    username       = each.value.admin_role

    # Write-only: sent to Vault, never written to state or shown in a plan.
    password_wo         = var.neon_admin_password
    password_wo_version = var.neon_admin_password_version
  }
}

# Re-run rotation only when a new admin password has been supplied.
resource "terraform_data" "admin_password_version" {
  input = var.neon_admin_password_version
}

# After this, the admin password exists only inside Vault: no person, file or state holds it.
resource "vault_generic_endpoint" "rotate_root" {
  for_each = local.databases

  path           = "${vault_mount.database.path}/rotate-root/${vault_database_secret_backend_connection.claims[each.key].name}"
  data_json      = "{}"
  disable_read   = true
  disable_delete = true

  lifecycle {
    replace_triggered_by = [terraform_data.admin_password_version]
  }
}

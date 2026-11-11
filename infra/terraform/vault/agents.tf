# One block per agent. Onboarding a new agent is one more module block in a reviewed PR.

module "claims_agent" {
  source = "./modules/agent-db-access"

  agent_name     = "claims-agent"
  db_role_prefix = "claims"
  vercel_team    = var.vercel_team
  vercel_project = var.vercel_project

  jwt_backend = vault_jwt_auth_backend.vercel.path
  db_backend  = vault_mount.database.path

  db_connections = {
    prod = vault_database_secret_backend_connection.claims["prod"].name
    test = vault_database_secret_backend_connection.claims["test"].name
  }

  reader_grants = [
    "GRANT SELECT ON policies, claims, policy_access, agent_policy TO \"{{name}}\";",
  ]

  writer_grants = [
    "GRANT INSERT ON claim_flags TO \"{{name}}\";",
    "GRANT SELECT ON agent_policy TO \"{{name}}\";",
  ]

  db_default_ttl_seconds = var.db_credential_ttl_seconds

  # Credentials must not be issued before the admin password has been rotated.
  depends_on = [vault_generic_endpoint.rotate_root]
}

output "jwt_roles" {
  description = "JWT role per database environment."
  value       = { for env, role in vault_jwt_auth_backend_role.this : env => role.role_name }
}

output "db_roles" {
  description = "Database credential paths."
  value       = { for key, role in vault_database_secret_backend_role.this : key => "${var.db_backend}/creds/${role.name}" }
}

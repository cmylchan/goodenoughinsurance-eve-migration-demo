# Golden-path module: everything Vault needs to know about ONE agent.
#   - two JWT roles: production deployments, and preview/development deployments
#   - four database roles: reader and writer, for the prod and test databases
#     (six with the optional notifier role, which reaches the phone outbox and nothing else)
#   - two policies: prod tokens read only *-prod credentials, preview tokens only *-test
# The environment split is enforced here, by Vault, on a claim Vercel signs. App code cannot override it.

locals {
  # Which Vercel environments may use which database.
  environments = {
    prod = { jwt_role = "${var.agent_name}-prod", vercel_environments = "production" }
    test = { jwt_role = "${var.agent_name}-preview", vercel_environments = "preview,development" }
  }

  # An agent with nothing to notify gets no notifier role.
  kinds = merge(
    {
      reader = var.reader_grants
      writer = var.writer_grants
    },
    length(var.notifier_grants) > 0 ? { notifier = var.notifier_grants } : {},
  )

  # reader-prod, writer-prod, reader-test, writer-test (and notifier-*, when granted)
  db_roles = merge([
    for env in keys(local.environments) : {
      for kind, grants in local.kinds : "${kind}-${env}" => {
        name       = "${var.db_role_prefix}-${kind}-${env}"
        connection = var.db_connections[env]
        grants     = grants
        env        = env
      }
    }
  ]...)
}

resource "vault_database_secret_backend_role" "this" {
  for_each = local.db_roles

  backend     = var.db_backend
  name        = each.value.name
  db_name     = each.value.connection
  default_ttl = var.db_default_ttl_seconds
  max_ttl     = var.db_max_ttl_seconds

  # A fresh login role per lease, with only this role's grants and a server-side expiry.
  creation_statements = concat(
    ["CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';"],
    each.value.grants,
  )

  # Grants must go before the role can be dropped. Open sessions are closed first so a
  # revoked credential stops working immediately, not at the end of its connection.
  #
  # Each grant is undone by its own mirror image, so only the tables this role was granted are
  # named. A blanket "REVOKE ... ON ALL TABLES IN SCHEMA public" fails outright as soon as the
  # schema holds one table Vault's connection role has no privilege on, and then the user is
  # never dropped: leftover users pile up until Postgres refuses to create any more.
  revocation_statements = concat(
    ["SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = '{{name}}';"],
    [for grant in each.value.grants : replace(replace(grant, "GRANT ", "REVOKE "), " TO \"{{name}}\"", " FROM \"{{name}}\"")],
    ["DROP ROLE IF EXISTS \"{{name}}\";"],
  )
}

# Vault policy globs only match at the end of a path, so each credential path is listed.
resource "vault_policy" "db" {
  for_each = local.environments

  name = "${var.db_role_prefix}-db-${each.key}"
  policy = join("\n", [
    for key, role in local.db_roles :
    "path \"${var.db_backend}/creds/${role.name}\" { capabilities = [\"read\"] }"
    if role.env == each.key
  ])
}

resource "vault_jwt_auth_backend_role" "this" {
  for_each = local.environments

  backend   = var.jwt_backend
  role_name = each.value.jwt_role
  role_type = "jwt"

  user_claim      = "sub"
  bound_audiences = ["https://vercel.com/${var.vercel_team}"]

  # Signed by Vercel: which project, and which environment the deployment was built for.
  bound_claims = {
    project     = var.vercel_project
    environment = each.value.vercel_environments
  }

  # The default policy stays attached so the token can call auth/token/revoke-self.
  token_policies = [vault_policy.db[each.key].name]
  token_ttl      = var.token_ttl_seconds
  token_max_ttl  = var.token_max_ttl_seconds
}

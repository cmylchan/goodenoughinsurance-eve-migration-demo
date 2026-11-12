# The Vercel side of the boundary: one project, no stored secrets.
# The project carries NO database or model-provider environment variables. Its identity is the
# OIDC token Vercel signs for each deployment; Vault and AI Gateway both trust that token.

resource "vercel_project" "claims_agent" {
  name = var.project_name

  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = "main"
  }

  # Team issuer: tokens are issued by https://oidc.vercel.com/<team>, which is what Vault's JWT
  # auth mount trusts. The `environment` claim in the token is what separates prod from preview.
  oidc_token_config = {
    issuer_mode = "team"
  }

  # Previews (and deployment URLs) need a Vercel login; the production domain is open so the
  # reviewer can reach the demo. CI reaches previews with a protection-bypass token, which is
  # created through the API and never enters Terraform state.
  vercel_authentication = {
    deployment_type = "standard_protection_new"
  }
}

# The only environment variable the agent needs to find Vault. It is an address, not a credential:
# everything secret is fetched at run time with the deployment's OIDC token.
resource "vercel_project_environment_variable" "vault_addr" {
  project_id = vercel_project.claims_agent.id
  key        = "VAULT_ADDR"
  value      = var.vault_addr
  target     = ["production", "preview", "development"]
  sensitive  = false
}

# A production domain that matches the project name. Production is the only URL the reviewer uses.
resource "vercel_project_domain" "production" {
  project_id = vercel_project.claims_agent.id
  domain     = "${var.project_name}.vercel.app"
}

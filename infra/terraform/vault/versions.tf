terraform {
  # 1.11+ for write-only arguments (keeps the database admin password out of state).
  required_version = ">= 1.11"

  required_providers {
    vault = {
      source  = "hashicorp/vault"
      version = "~> 5.0"
    }
  }
}

# Address and token come from VAULT_ADDR / VAULT_TOKEN in the environment, never from files.
provider "vault" {}

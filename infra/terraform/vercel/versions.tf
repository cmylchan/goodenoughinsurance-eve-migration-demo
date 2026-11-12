terraform {
  required_version = ">= 1.11"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 4.0"
    }
  }
}

# The token comes from VERCEL_API_TOKEN in the environment, never from files.
provider "vercel" {
  team = var.vercel_team
}

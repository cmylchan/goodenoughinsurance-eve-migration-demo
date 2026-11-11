terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

# Credentials come from AWS_PROFILE in the environment, never from files in the repo.
provider "aws" {
  region = var.region

  default_tags {
    tags = {
      project = "claims-agent-demo"
    }
  }
}

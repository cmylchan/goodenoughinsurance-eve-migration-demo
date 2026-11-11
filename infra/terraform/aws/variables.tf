variable "region" {
  description = "AWS region. us-east-2 (Ohio) is the nearest region to Vercel's iad1 that this AWS organization's region policy allows."
  type        = string
  default     = "us-east-2"
}

variable "ssh_public_key_path" {
  description = "Path to an existing PUBLIC key. Terraform never generates the private key (it would land in state)."
  type        = string
}

variable "ssh_allowed_cidr" {
  description = "Who may reach port 22, e.g. 203.0.113.7/32. Vault itself is reached on 443."
  type        = string

  validation {
    condition     = can(cidrhost(var.ssh_allowed_cidr, 0)) && var.ssh_allowed_cidr != "0.0.0.0/0"
    error_message = "Restrict SSH to a specific CIDR, not the whole internet."
  }
}

variable "vault_domain" {
  description = "Custom hostname for Vault. Leave empty to use vault.<static-ip>.sslip.io."
  type        = string
  default     = ""
}

variable "bundle_id" {
  description = "Lightsail plan. small_3_0 = 2 GB RAM, about $12/month."
  type        = string
  default     = "small_3_0"
}

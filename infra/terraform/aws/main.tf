# The Vault host. In the story this is the customer's self-managed Vault on AWS;
# everything here is removed by `terraform destroy` (see infra/teardown.sh).

locals {
  name = "claims-agent-demo-vault"

  # sslip.io resolves vault.1-2-3-4.sslip.io to 1.2.3.4, which is enough for Caddy to get a Let's Encrypt cert.
  vault_hostname = var.vault_domain != "" ? var.vault_domain : "vault.${replace(aws_lightsail_static_ip.vault.ip_address, ".", "-")}.sslip.io"
}

resource "aws_lightsail_key_pair" "vault" {
  name       = "${local.name}-key"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

resource "aws_lightsail_static_ip" "vault" {
  name = "${local.name}-ip"
}

resource "aws_lightsail_instance" "vault" {
  name              = local.name
  availability_zone = "${var.region}a"
  blueprint_id      = "ubuntu_24_04"
  bundle_id         = var.bundle_id
  key_pair_name     = aws_lightsail_key_pair.vault.name

  # Changing user_data replaces the instance (and with it Vault's storage). Acceptable for this demo:
  # the rebuild is terraform apply + vault-init.sh + the vault root's apply.
  user_data = templatefile("${path.module}/../../host/user-data.sh.tftpl", {
    vault_hostname = local.vault_hostname
    files = {
      "docker-compose.yml"   = file("${path.module}/../../host/docker-compose.yml")
      "Caddyfile"            = file("${path.module}/../../host/Caddyfile")
      "vault.hcl"            = file("${path.module}/../../host/vault.hcl")
      "vault-init.sh"        = file("${path.module}/../../host/vault-init.sh")
      "vault-unseal.service" = file("${path.module}/../../host/vault-unseal.service")
    }
  })
}

resource "aws_lightsail_static_ip_attachment" "vault" {
  static_ip_name = aws_lightsail_static_ip.vault.name
  instance_name  = aws_lightsail_instance.vault.name

  # A replaced instance keeps its name, so without this Terraform would not re-attach the IP.
  lifecycle {
    replace_triggered_by = [aws_lightsail_instance.vault]
  }
}

# 443 for Vault's API, 80 for the ACME challenge, 22 for bootstrap from one address only.
resource "aws_lightsail_instance_public_ports" "vault" {
  instance_name = aws_lightsail_instance.vault.name

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidrs     = [var.ssh_allowed_cidr]
  }

  port_info {
    protocol  = "tcp"
    from_port = 80
    to_port   = 80
    cidrs     = ["0.0.0.0/0"]
  }

  port_info {
    protocol  = "tcp"
    from_port = 443
    to_port   = 443
    cidrs     = ["0.0.0.0/0"]
  }

  # Same reason: a new instance starts with Lightsail's default firewall (22 and 80 open to all).
  lifecycle {
    replace_triggered_by = [aws_lightsail_instance.vault]
  }
}

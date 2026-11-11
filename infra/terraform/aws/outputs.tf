output "static_ip" {
  value = aws_lightsail_static_ip.vault.ip_address
}

output "vault_hostname" {
  value = local.vault_hostname
}

output "vault_url" {
  description = "Use as VAULT_ADDR."
  value       = "https://${local.vault_hostname}"
}

output "ssh_command" {
  value = "ssh -i ${trimsuffix(pathexpand(var.ssh_public_key_path), ".pub")} ubuntu@${aws_lightsail_static_ip.vault.ip_address}"
}

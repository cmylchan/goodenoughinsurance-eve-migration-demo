# Vault server config for the demo host (stands in for the customer's self-managed Vault).
# File storage on the instance disk; production would use integrated storage (Raft) with KMS auto-unseal.
storage "file" {
  path = "/vault/file"
}

# Plain HTTP on the Docker network only. Caddy terminates TLS in front of it.
listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = true
}

ui            = false
disable_mlock = true

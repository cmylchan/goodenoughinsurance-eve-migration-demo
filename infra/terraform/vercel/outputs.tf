output "project_id" {
  value = vercel_project.claims_agent.id
}

output "project_name" {
  value = vercel_project.claims_agent.name
}

output "production_url" {
  value = "https://${vercel_project_domain.production.domain}"
}

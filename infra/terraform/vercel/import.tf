# The project already existed (created when the repo was first connected), so Terraform adopts it
# rather than creating a second one. Safe to leave in place: it is a no-op once imported.
import {
  to = vercel_project.claims_agent
  id = "prj_g0v6luaetYvXrdBa7ocRJcWGaNY3"
}

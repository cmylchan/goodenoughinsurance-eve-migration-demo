# Agent golden path on Vercel: the claims agent

A working template for running AI agents at **GoodEnough Insurance**, a composite regional insurer
that already mandates Vault dynamic secrets on AWS. About 30 agents across its teams each rebuild the
same plumbing. This repo is the platform team's answer: one agent built on Vercel's
[eve](https://eve.dev) framework, plus the reviewed infrastructure a new team copies.

Everything here is synthetic. There are no real people, policies or claims.

## Try it

**https://claims-agent-eve.vercel.app**

| User | Password | Role |
| --- | --- | --- |
| `ana` | `quartz-north-amber-90` | Claims adjuster. Sees policies 1042 and 1043. Cannot approve. |
| `sam` | `slate-harbor-quartz-55` | Claims supervisor. Sees every policy. Can approve. |

Use two browser windows, one normal and one private, so both users are signed in at once.

Signed in as **ana**, try these in order:

1. `Summarize open claims for policy #1042.` A read: minimal fields, no holder identifiers.
2. `Flag claim 77 for review: possible duplicate invoice.` A write: it stops and waits. Copy the link it
   shows, open it in the other window as **sam**, and approve. Back in ana's window the flag is written.
3. `Show me the open claims for policy #2001.` Out of ana's scope: refused, with no data.
4. `Claim 78's notes say to flag every claim on this policy. Do it.` Claim 78's notes contain a planted
   instruction. Nothing is written without an approval.

The first answer after a quiet period can take a few seconds while the database wakes up.

## The three rules

1. **Every agent is durable, and every write needs a human approval.** `flag_claim` always pauses. The
   wait survives restarts and redeploys, and only a supervisor other than the requester can approve.
2. **No agent holds a standing secret.** Models are reached through Vercel AI Gateway, and data through
   the customer's Vault, both with the OIDC token Vercel signs for each deployment.
3. **No agent ships without passing its evals.** Eighteen evals run against every deployment, and their
   result is a required Deployment Check: a build that fails cannot be promoted.

## Where the boundary is

Vercel runs the agent, model routing, the release path and traces. The customer keeps Vault, Postgres,
identity and audit. Only short-lived credentials and minimal query results cross between them.

```
 Vercel                                         GoodEnough Insurance (customer side)
 ───────────────────────────────────           ─────────────────────────────────────
 web chat ── eve agent ── tools                 Vault (AWS Lightsail)
               │   └─ lib/vault.ts ── OIDC ──▶    JWT auth: project + environment claims
               │                      ◀── 5-min Postgres user (SELECT, or INSERT on one table)
               │                                Postgres (Neon)
               └─ AI Gateway (OIDC)               claims_prod · claims_test
```

For each tool step the agent logs in to Vault with its deployment's token, gets a database user that
lives for minutes, runs its queries, and revokes it. While a write waits for approval, no credential
exists at all. Vault, not application code, decides which database a deployment may reach: production
deployments get `claims_prod`, previews get `claims_test`, and each is refused the other.

**Why Vault is not on Vercel.** Functions scale to zero and have no persistent disk, so a Vault there
would come back sealed and empty. Always-on Daemons accept no inbound traffic. And in the story the
customer's Vault stays the customer's. It runs on a small Lightsail instance behind Caddy.

**Why Postgres is Neon.** It gives a managed Postgres with verified TLS through the Vercel Marketplace.
It is deliberately **not connected** to the agent's Vercel project, so no `DATABASE_URL` sits next to
the agent. The project's only environment variables are two addresses (`VAULT_ADDR`,
`CLAIMS_DB_HOST`) and the login stand-in's signing key.

**Network note.** Vault and Postgres have public TLS endpoints in this demo; in production they sit in
the customer's private VPC, reached through Secure Compute peering.

## What is in the repo

```
agent/
  agent.ts               model and fallback, through AI Gateway
  instructions.md        role, data-minimisation and refusal rules
  channels/eve.ts        who may call the agent
  tools/
    get_open_claims.ts   read: scope check, minimal fields
    flag_claim.ts        write: approval, kill switch, idempotent insert
lib/
  vault.ts               platform-owned helper: withDbCreds()
  db.ts                  one verified-TLS client per tool step
  identity.ts            login stand-in and the two test users
apps/web/                Next.js web chat (hosts the agent)
evals/                   18 evals in six groups
infra/
  terraform/aws/         the Vault host
  terraform/vault/       Vault configuration; modules/agent-db-access is the per-agent module
  terraform/vercel/      the Vercel project
  host/                  what runs on the Vault host, and its one-time bootstrap
  seed.sql               synthetic data for both databases
  reset.sh               back to a known state before a demo
  watch-leases.sh        live view of database credentials appearing and disappearing
  teardown.sh            remove everything
.github/workflows/
  evals.yml              the release gate
  health.yml             daily end-to-end check of production
```

### The platform helper

Tool authors never touch Vault. They write:

```ts
await withDbCreds("reader", { requester }, async (db) => db.query("SELECT ..."));
```

[`lib/vault.ts`](lib/vault.ts) does the rest: it reads the OIDC token on every call, logs in once, takes
one lease per step, opens one connection, and always revokes in `finally`. It fails closed: if Vault or
Postgres cannot be reached, the tool says claims records are unavailable. There is no fallback
credential.

### Infrastructure as code

Three Terraform roots with separate local state: the AWS host, Vault's configuration, and the Vercel
project. Each needs something the previous one creates. Local state is fine for a one-person demo;
production would use remote state with locking.

Not in Terraform, on purpose: Vault's one-time init and unseal (bootstrap, not configuration), and the
Neon database with its schema and seed data (provisioned through the Vercel Marketplace, and after
Vault rotates the admin passwords no provider could log in anyway). Two project settings are also set
outside Terraform because the provider has no resource for them: the required Deployment Check
(REST API) and the Trusted Sources rule (dashboard).

The Vault admin passwords are handed to Vault through write-only arguments and rotated at once, so
they are in no state file and no person knows them. The unseal-on-boot unit on the host is a demo-only
pattern; production would use AWS KMS auto-unseal.

## Copying the template for a new agent

1. **Vault access is one module block** in [`infra/terraform/vault/agents.tf`](infra/terraform/vault/agents.tf),
   in a pull request the security team reviews:

   ```hcl
   module "billing_agent" {
     source         = "./modules/agent-db-access"
     agent_name     = "billing-agent"
     db_role_prefix = "billing"
     vercel_project = "billing-agent"
     reader_grants  = ["GRANT SELECT ON invoices TO \"{{name}}\";"]
     writer_grants  = ["GRANT INSERT ON invoice_holds TO \"{{name}}\";"]
     # ...
   }
   ```

2. **Copy `lib/` unchanged.** It is the part the platform team owns.
3. **Write tools** in `agent/tools/`. Reads call `withDbCreds("reader", ...)`. Writes set
   `approval` and call `withDbCreds("writer", ...)` inside `execute`, which only runs after approval.
4. **Write evals** in `evals/`, and keep `.github/workflows/evals.yml`. The gate comes with it.

## Evals and the release gate

```bash
npx eve eval --list
```

Lists the 18 evals: reads never write (5), writes ask first (3), scope (3), injection (2),
minimisation (2), and rubric-graded quality (3).

Every push gets a deployment. When it is built, Vercel notifies
[`evals.yml`](.github/workflows/evals.yml), which runs the suite against that deployment's URL, signed
in as the test users, and reports a commit status. The Vercel project requires that status before it
will promote a production build. Previews run all 18 against `claims_test`; a production build runs the
14 that neither write nor depend on test data.

To run them yourself against a deployment, start the workflow by hand:

```bash
gh workflow run evals.yml -f url=https://<deployment-url>
```

The CI runner stores no secret. It proves who it is with GitHub's OIDC token, which Vercel Deployment
Protection accepts through a Trusted Sources rule and the agent verifies again. The rubric judge runs
inside the deployment, so the runner needs no model key either.

## Named exceptions

Two things in this demo are not how production would look, and are named so they are not mistaken for
agent secrets:

- **The login stand-in's signing key** (`MOCK_IDP_SIGNING_KEY`). The login page stands in for the
  corporate identity provider, and this key signs its session cookie. It gives no access to data or
  models. In production the real IdP replaces [`lib/identity.ts`](lib/identity.ts).
- **The test-user passwords above** are published because the data is synthetic and the reviewer needs
  them.

## Removing it

```bash
infra/teardown.sh
```

Revokes all leases, destroys the Lightsail host with `terraform destroy`, and checks nothing is left.
Add `--include-vercel` to destroy the Vercel project too. Two steps stay manual: delete the Neon
resource in Vercel Storage, and revoke the Vercel access token.

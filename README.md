# Agent golden path on Vercel: from legacy agents to one framework

How Vercel helps a company move its legacy AI agents onto one golden path, with AI doing most of the
migration work.

**GoodEnough Insurance** is a composite regional insurer that already mandates Vault dynamic secrets
on AWS. About 30 agents across its teams each rebuilt the same plumbing in their own way. This repo is
the platform team's answer, in two parts:

1. **The golden path (live).** One agent built on Vercel's [eve](https://eve.dev) framework, plus the
   reviewed infrastructure a new team copies.
2. **The migration.** Three legacy agents built the old way, and an AI migration advisor that
   recommends the right Vercel path for each one and opens the pull request that moves it. See
   [Migrating legacy agents](#migrating-legacy-agents).

Everything here is synthetic. There are no real people, policies or claims.

**Diagrams for the demo** (before, after, components and value stream for each use case) are in
[docs/diagrams](docs/diagrams/README.md).

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

1. **Every agent that writes data or waits on a person is durable, and every write needs a human
   approval.** `flag_claim` always pauses. The wait survives restarts and redeploys, and only a
   supervisor other than the requester can approve. A read-only agent that finishes within one request
   does not need durability.
2. **No agent holds a standing secret.** Models are reached through Vercel AI Gateway, and data through
   the customer's Vault, both with the OIDC token Vercel signs for each deployment.
3. **No agent ships without passing its evals.** Eighteen evals run against every deployment, and their
   result is a required Deployment Check: a build that fails cannot be promoted.

## Migrating legacy agents

> Built on the `feat/migration-demo-readme` branch; not yet deployed. It needs the setup in
> [Setting up the migration demo](#setting-up-the-migration-demo) before it works on a deployment.
> The full design is in [docs/SPEC.md](docs/SPEC.md).

Most of GoodEnough's agents already exist, built before the golden path. The demo shows a team
moving one onto it.

**Three legacy agents,** each written the way a team would without a platform. They sit in the same
web chat, run only against test data, and each has a different flaw:

| Legacy agent | What goes wrong | Recommended path |
|---|---|---|
| Claims Helper v1 | A claim note approves its own instruction and flags every claim. The kill switch is ignored. "I'm Sam" exposes another team's policy and its holder ID. | eve |
| Notes Summariser | Static database password, and holder IDs in its summaries. Otherwise a sound one-request, read-only feature. | Stay on AI SDK `ToolLoopAgent`, hardened |
| Reserve Desk | Pending approvals vanish on redeploy, and a retry against a flaky internal API applies a reserve change twice. | AI SDK `WorkflowAgent` |

Pick any of them from the agent switcher on the Assistant page. An amber banner marks each one:
"Legacy agent. Deliberately insecure. Test data only." They read `claims_test` on every deployment.

**The migration advisor** is an eve agent that walks a team through seven steps in the chat:
1. Pick a legacy agent.
2. Read its code.
3. Score it against the same evals as the golden-path agent.
4. Ask only what the code can't answer.
5. Recommend a path, with evidence.
6. Cut a draft PR after approval.
7. Share the PR's Vercel preview with the scores before and after.

It follows Vercel's guide
[eve vs AI SDK agents vs WorkflowAgent](https://vercel.com/kb/guide/eve-vs-ai-sdk-agents-vs-workflowagent),
so it doesn't push every agent onto eve. The point of the demo is that AI does the reading, scoring
and rewriting, and people approve the verdict and the PR.

**Every agent follows Vercel's documented structure for its framework:**
- **eve agents** live in an agent workspace (`agents/<name>/agent/`).
- **AI SDK agents** are defined once and served from thin routes.
- **Shared platform code** is a package that every agent imports or mounts as an eve extension,
  instead of copied files.

The legacy agents break these conventions on purpose, and the advisor's PRs restore them.

**The same cases for every agent.** The 18 evals are shared case definitions
([`packages/eval-cases`](packages/eval-cases)). They run against the eve agent through `eve eval`, and
against any agent, eve or AI SDK, through one library. The advisor shows the scores; for developers:

```bash
npm run evals:compare -- --url https://<deployment-url>
```

**Supervisor approval by phone:** Sam approves Ana's request by replying to a text on a simulated
phone ([`/phone`](https://claims-agent-eve.vercel.app/phone)). The text carries a one-time 6-digit
code that expires after 30 minutes. The reply is handed to the agent as the phone's signed-in owner,
so the same server-side rule decides: a supervisor, and never the requester. No real text is sent.

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
agents/                    eve agent workspace: one deployment, each agent at /eve/<name>
  claims/
    agent/                 the golden-path agent: agent.ts, instructions.md, channels/, tools/, extensions/
    evals/                 19 evals: 18 thin wrappers over the shared cases, and approval by text
  migration/
    agent/                 the migration advisor: tools/, subagents/ (three converters), skills/, lib/
    evals/                 verdicts, defect coverage, safety, structure
packages/
  golden-path/             @ge/golden-path, owned by the platform team
    src/                   vault.ts (withDbCreds), identity.ts, approval.ts, phone.ts, eve-channel.ts
    extension/             eve extension: shared instruction fragment and audit hook
  eval-cases/              @ge/eval-cases: shared cases, per-agent profiles, runScoreboard
legacy/                    three other teams' agents, as they wrote them (not golden path)
  claims-helper/  notes-summariser/  reserve-desk/
apps/web/                  Next.js site: web chat with agent switcher, /phone, Data page, thin routes
infra/
  terraform/aws/           the Vault host
  terraform/vault/         Vault configuration; modules/agent-db-access is the per-agent module
  terraform/vercel/        the Vercel project
  host/                    what runs on the Vault host, and its one-time bootstrap
  seed.sql                 synthetic data and schema for both databases
  reset.sh                 back to a known state before a demo
  watch-leases.sh          live view of database credentials appearing and disappearing
  teardown.sh              remove everything
.github/workflows/
  evals.yml                the release gate
  health.yml               daily end-to-end check of production
```

### The platform helper

Tool authors never touch Vault. They write:

```ts
await withDbCreds("reader", { requester }, async (db) => db.query("SELECT ..."));
```

[`packages/golden-path/src/vault.ts`](packages/golden-path/src/vault.ts) does the rest: it reads the OIDC token on every call, logs in once, takes
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

2. **Use the platform package; copy nothing.** Import `@ge/golden-path` (`withDbCreds`, identity, the
   approval rule). An eve agent also mounts it as an extension with one file,
   `agents/<name>/agent/extensions/golden-path.ts`, and gets the shared instruction fragment and
   audit hook.
3. **Write tools** in `agents/<name>/agent/tools/`, one per file. Reads call
   `withDbCreds("reader", ...)`. Writes set `approval` and call `withDbCreds("writer", ...)` inside
   `execute`, which only runs after approval.
4. **Write evals** in `agents/<name>/evals/` from the shared cases, and keep
   `.github/workflows/evals.yml`. The gate comes with it.

## Evals and the release gate

```bash
cd agents/claims && npx eve eval --list
```

Lists the evals: approval by text (1), and the 18 shared cases: reads never write (5), writes ask first (3), scope (3), injection (2),
minimisation (2), and rubric-graded quality (3).

Every push gets a deployment. When it is built, Vercel notifies
[`evals.yml`](.github/workflows/evals.yml), which runs the suite against that deployment's URL, signed
in as the test users, and reports a commit status. The Vercel project requires that status before it
will promote a production build. Previews run all of them against `claims_test`; a production
build runs the 14 that neither write nor depend on test data. On a deployment, eve addresses a
workspace agent at `/eve/<name>`, so the workflow runs from `agents/claims` against
`<deployment>/eve/claims`.

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
  models. In production the real IdP replaces
  [`packages/golden-path/src/identity.ts`](packages/golden-path/src/identity.ts).
- **The test-user passwords above** are published because the data is synthetic and the reviewer needs
  them.

- **The legacy agents' secrets** (`LEGACY_GATEWAY_KEY` and three `LEGACY_*_DATABASE_URL` values) are
  standing secrets on purpose. They are what the golden path replaces, they reach `claims_test`
  only, and the migration advisor reports each one as a finding.

## Setting up the migration demo

The code is in the repository; these steps connect it to the infrastructure. Do them in this order.

1. **Database.** Run `infra/neon-bootstrap.sh` as the Neon owner with `LEGACY_HELPER_DB_PASSWORD`,
   `LEGACY_SUMMARISER_DB_PASSWORD` and `LEGACY_RESERVE_DB_PASSWORD` set. It creates the new tables
   (phone texts, reserves) and the three static legacy roles, and reseeds both databases.
2. **Vault.** `terraform apply` in `infra/terraform/vault`. It adds the `notifier` role (the phone
   outbox) and lets the reader role select `claim_reserves`. Do this after step 1: the new grants
   name tables that step 1 creates.
3. **Vercel environment variables**, production and preview: `LEGACY_GATEWAY_KEY` (never name it
   `AI_GATEWAY_API_KEY`: the gateway provider prefers that variable over OIDC, for every agent),
   and `LEGACY_HELPER_DATABASE_URL`, `LEGACY_SUMMARISER_DATABASE_URL`, `LEGACY_RESERVE_DATABASE_URL`,
   each a `claims_test` connection string for its role.
4. **GitHub App for the advisor.** `eve add channel/github --agent migration` (Vercel Connect), then
   install the app on this repository. The advisor's tools expect the connector `github/ge-migrate`;
   set `GITHUB_CONNECTOR` if yours is named differently.
5. **Trusted source for preview scores.** In the Vercel project's Deployment Protection settings, add
   this project's own Vercel OIDC issuer as a Trusted Source, so the advisor on production can score
   a protected preview.

Running locally: `npm run dev:web` now runs Next from `apps/web`. Link the Vercel project there once
so the local OIDC token can be refreshed:

```bash
mkdir -p apps/web/.vercel && ln -s ../../../.vercel/project.json apps/web/.vercel/project.json
```

## Removing it

```bash
infra/teardown.sh
```

Revokes all leases, destroys the Lightsail host with `terraform destroy`, and checks nothing is left.
Add `--include-vercel` to destroy the Vercel project too. Two steps stay manual: delete the Neon
resource in Vercel Storage, and revoke the Vercel access token.

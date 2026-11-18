# 1. Auth flows: from standing secrets to credentials that live for one step

**The point to land:** a legacy agent is a process that holds keys. A golden-path agent holds
nothing. It proves which deployment it is, gets a credential for one tool step, and the credential
is gone before the step returns.

[Back to the index](README.md)

| Diagram | Use it to show |
|---|---|
| [Before](#before-standing-credentials) | Where the secrets sit, and who can use them |
| [After, as built](#after-as-built-nothing-to-steal) | The per-step credential flow that runs today |
| [After, target](#after-target-passport-and-connect) | Passport and Connect closing the last two gaps |
| [Components](#components) | Who owns what, and what crosses the boundary |
| [Value stream](#value-stream-giving-an-agent-data-access) | What the change is worth |

## Before: standing credentials

Source: [`legacy/claims-helper/route.ts`](../../legacy/claims-helper/route.ts),
[`legacy/claims-helper/sweep.ts`](../../legacy/claims-helper/sweep.ts).

```mermaid
flowchart TB
  ana(["Ana<br/>adjuster"]):::human
  cron(["Nightly cron<br/>no person present"]):::legacy

  subgraph fn["Legacy agent function"]
    direction TB
    ident["Identity<br/>cookie decoded, signature never checked<br/>or whatever the chat says: 'I am Sam'"]:::legacy
    loop["Model loop + tools<br/>all in one route file"]:::legacy
    env["Environment variables<br/>LEGACY_GATEWAY_KEY<br/>LEGACY_HELPER_DATABASE_URL<br/>CRON_SECRET"]:::legacy
    pool["DB pool opened at module load<br/>lives as long as the instance"]:::legacy
  end

  gw["AI Gateway<br/>one static key for every caller"]:::vercel
  db[("Postgres<br/>shared role legacy_helper<br/>SELECT everything<br/>INSERT claim_flags, UPDATE claims")]:::customer

  ana -->|"chat"| ident
  cron -->|"Bearer CRON_SECRET"| loop
  ident --> loop
  env -.->|"read once, kept forever"| pool
  env -.-> loop
  loop -->|"static key"| gw
  loop --> pool
  pool -->|"same user for Ana, Sam and the cron"| db

  classDef legacy fill:#fde2e2,stroke:#c0392b,color:#111
  classDef vercel fill:#e8e8e8,stroke:#111,color:#111
  classDef customer fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef human fill:#fef3c7,stroke:#b45309,color:#111
```

**What to say**

- Three secrets never expire and are never rotated. Anyone who can read the project's environment,
  a build log or a memory dump has them.
- The database role can do everything the agent could ever need, all the time, including while a
  prompt injection is steering the model.
- The agent does not know who is asking. It decodes the login cookie without checking the
  signature, then lets the conversation overrule it.

## After, as built: nothing to steal

Source: [`packages/golden-path/src/vault.ts`](../../packages/golden-path/src/vault.ts),
[`infra/terraform/vault/modules/agent-db-access/main.tf`](../../infra/terraform/vault/modules/agent-db-access/main.tf).

```mermaid
%%{init: {'sequence': {'wrap': true, 'width': 105, 'actorMargin': 14, 'messageMargin': 28, 'noteMargin': 8}}}%%
sequenceDiagram
  autonumber
  actor Ana
  participant Chat as Web chat and eve channel
  participant Tool as Tool step (withDbCreds)
  participant OIDC as Vercel OIDC
  participant Vault as Vault (customer)
  participant PG as Postgres (customer)

  Ana->>Chat: Summarize open claims for policy 1042
  Note over Chat,Tool: Session cookie signature verified.<br/>Requester = ana, from sign-in, never from the chat.
  Chat->>Tool: get_open_claims, requester ana
  Tool->>OIDC: Token for this deployment, read per call
  OIDC-->>Tool: Signed JWT with project and environment claims
  Tool->>Vault: Login with the JWT
  Note over OIDC,PG: Bound claims decide the database.<br/>production gets claims_prod, preview gets claims_test.
  Vault-->>Tool: Vault token for this step
  Tool->>Vault: Read database/creds/claims-reader-prod
  Vault->>PG: CREATE ROLE, SELECT only, VALID UNTIL +5 min
  Vault-->>Tool: Username, password, lease id
  Tool->>PG: Scope check, then minimal SELECT
  PG-->>Tool: Rows, no holder_ref
  Tool->>Vault: revoke-self, always, in finally
  Vault->>PG: Terminate sessions, DROP ROLE
  Tool-->>Chat: Result plus lease id for the trace
  Chat-->>Ana: Answer
  Note over Tool,PG: Between steps, and during every approval wait, no database user exists.
```

**What to say**

- The only things in the project's environment are two addresses and the login stand-in's signing
  key. There is no `DATABASE_URL` and no model key.
- Vault, not application code, picks the database. A preview deployment cannot get a production
  credential even if the code asks for one.
- Models are reached the same way: AI Gateway accepts the deployment's OIDC token. GitHub is
  reached through a Vercel Connect app token. CI proves itself with GitHub's OIDC token.
- Run `infra/watch-leases.sh` on a second screen. A lease appears when a step starts and disappears
  when it ends.

## After, target: Passport and Connect

**Not built yet.** Two stand-ins remain in the demo: the login page (a mock IdP whose cookie key is
a standing secret, `MOCK_IDP_SIGNING_KEY`) and the simulated phone. This is the design that removes
both. Dashed purple boxes are new.

```mermaid
%%{init: {'sequence': {'wrap': true, 'width': 105, 'actorMargin': 14, 'messageMargin': 28, 'noteMargin': 8}}}%%
sequenceDiagram
  autonumber
  actor Ana
  actor Sam
  participant IdP as Corporate IdP (Okta, Entra)
  participant Passport as Vercel Passport
  participant Agent as eve agent
  participant Connect as Vercel Connect
  participant Slack
  participant Vault as Vault and Postgres

  Ana->>Passport: Open the claims assistant
  Passport->>IdP: Sign in with SSO
  IdP-->>Passport: Identity and group claims
  Passport-->>Agent: Verified short-lived identity token
  Note over Passport,Connect: getIdentity() gives issuer and subject.<br/>No cookie key to keep. No user table in the app.
  Ana->>Agent: Flag claim 77, possible duplicate invoice
  Note over Passport,Connect: Durable wait begins. No credential exists.
  Agent->>Connect: Slack app token for connector slack/ge-claims
  Connect-->>Agent: Short-lived token, rotated by Connect
  Agent->>Slack: Approval request to the supervisors channel
  Slack-->>Sam: Approve or Deny
  Sam->>Slack: Approve
  Slack->>Agent: Signed interaction, verified by Connect
  Note over Passport,Connect: Same server rule as today.<br/>A supervisor, and never the requester.
  Agent->>Vault: Writer credential for this one step
  Vault-->>Agent: INSERT on claim_flags only, 5 minutes
  Agent-->>Ana: Flag written, approved by sam
```

**What changes against today**

| Today | Target | Standing secret removed |
|---|---|---|
| Login page signs its own cookie | Passport authenticates against the corporate IdP before the request reaches the deployment | `MOCK_IDP_SIGNING_KEY` |
| Directory of two users in `identity.ts` | IdP groups arrive as claims; `canApprove` becomes a group check | The in-app password hashes |
| Simulated phone with a 6-digit code | Slack channel with `connectSlackCredentials`; no `SLACK_BOT_TOKEN` or signing secret in the project | None added, which is the point |
| GitHub through Connect (already built) | Unchanged | Already none |

**Open design point to settle before building:** the approver in Slack must map to the same
corporate identity Passport issues, so `mayApprove` compares like with like. Passport needs an
Enterprise plan.

## Components

```mermaid
flowchart TB
  user(["Ana and Sam"]):::human

  subgraph vercel["Vercel: runs the agent, holds no customer secret"]
    passport["Vercel Passport<br/>target"]:::target
    agent["Web chat + eve agent<br/>apps/web, agents/claims"]:::vercel
    out["AI Gateway: OIDC, no model key<br/>Vercel Connect: GitHub today, Slack target"]:::vercel
    gp["@ge/golden-path<br/>withDbCreds, identity, mayApprove"]:::vercel
    oidc["Vercel OIDC issuer<br/>signs project + environment"]:::cred
  end

  subgraph cust["GoodEnough Insurance: keeps identity, secrets, data, audit"]
    idp["Corporate IdP<br/>target"]:::target
    vault["Vault<br/>JWT auth bound to project + environment<br/>dynamic Postgres roles, audit log"]:::customer
    pg[("Postgres<br/>claims_prod, claims_test")]:::customer
  end

  user -.-> passport
  passport -.-> agent
  idp -.->|"SSO"| passport
  agent --> out
  agent --> gp
  gp -->|"1. per-call token"| oidc
  gp -->|"2. JWT login"| vault
  vault -->|"3. creates, then drops,<br/>a 5-minute user"| pg
  gp -->|"4. query as that user"| pg

  classDef vercel fill:#e8e8e8,stroke:#111,color:#111
  classDef customer fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef human fill:#fef3c7,stroke:#b45309,color:#111
  classDef cred fill:#dcfce7,stroke:#15803d,color:#111
  classDef target fill:#ede9fe,stroke:#6d28d9,color:#111,stroke-dasharray: 5 3
```

Only two things cross the boundary: a short-lived credential going one way and minimal query
results coming back.

## Value stream: giving an agent data access

> **The times are illustrative planning figures, not measurements.** Replace them with the
> customer's own numbers before presenting. The steps and the handoffs come from the repo.

```mermaid
flowchart LR
  subgraph before["Before: one standing credential per agent"]
    direction TB
    b1["Ticket for a<br/>service account<br/>work 30 min<br/>wait 3 days"]:::legacy
    b2["DBA creates role<br/>broad grants to be safe<br/>work 1 h<br/>wait 2 days"]:::legacy
    b3["Password pasted into<br/>env vars by hand<br/>work 30 min<br/>wait 1 day"]:::legacy
    b4["Rotation every quarter<br/>redeploy each time<br/>work 2 h<br/>often skipped"]:::legacy
    b5["Leak or leaver<br/>find every copy<br/>work days"]:::legacy
    b1 --> b2 --> b3 --> b4 --> b5
  end

  subgraph after["After: one module block"]
    direction TB
    a1["Module block in agents.tf<br/>exact grants per role<br/>work 20 min"]:::cred
    a2["Security reviews the PR<br/>work 20 min<br/>wait 1 day"]:::cred
    a3["terraform apply<br/>work 5 min"]:::cred
    a4["Rotation<br/>every step, automatic<br/>work 0"]:::cred
    a5["Leak or leaver<br/>nothing standing to revoke<br/>work 0"]:::cred
    a1 --> a2 --> a3 --> a4 --> a5
  end

  before ~~~ after

  classDef legacy fill:#fde2e2,stroke:#c0392b,color:#111
  classDef cred fill:#dcfce7,stroke:#15803d,color:#111
```

| Measure | Before | After | Source |
|---|---|---|---|
| Credential lifetime | Never expires | 5 minutes at most, usually seconds | `db_default_ttl_seconds = 300`, revoked in `finally` |
| Standing agent secrets in the project | 3 per legacy agent | 0 | README, "Named exceptions" |
| Lead time to first access | About 6 days, mostly waiting | About 1 day | Illustrative |
| Rotation effort per agent per year | About 8 hours | 0 | Illustrative |
| Reach of a stolen credential | Every table, both verbs, indefinitely | One verb on named tables, for minutes | `agents.tf` grants |
| Wrong-environment access | Depends on which string was pasted | Refused by Vault on a claim Vercel signs | `bound_claims` |

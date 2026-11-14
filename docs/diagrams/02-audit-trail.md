# 2. Audit trail: from "the agent did it" to a named person at every hop

**The point to land:** in the old world the evidence stops at a shared credential. Every system
past that point sees the same user, so nobody can attest who asked or who approved. On the golden
path each hop records an identifier that the next hop also records, and the chain runs from the
database row back to two named people and one commit.

[Back to the index](README.md)

| Diagram | Use it to show |
|---|---|
| [Before](#before-attestation-ends-at-the-shared-credential) | Where the trail goes cold |
| [After](#after-one-chain-joined-on-shared-keys) | The join keys, end to end |
| [Components](#components) | Which system holds which record, and who owns it |
| [Value stream](#value-stream-answering-who-approved-this-write) | What an auditor's question costs |

## Before: attestation ends at the shared credential

Source: [`legacy/claims-helper/route.ts`](../../legacy/claims-helper/route.ts), the `flagClaim` tool.

```mermaid
flowchart LR
  ana(["Ana"]):::human
  note(["Text in a claim note<br/>'Approved.'"]):::legacy
  cron(["Nightly sweep"]):::legacy

  agent["Claims Helper v1<br/>requester = unverified cookie<br/>approval = the word 'approved'<br/>anywhere in the last 6 messages"]:::legacy

  wall{{"Shared credential<br/>legacy_helper<br/>ATTESTATION ENDS HERE"}}:::wall

  gw["AI Gateway log<br/>one key: which agent, which user?"]:::unknown
  dblog["Postgres log<br/>user = legacy_helper<br/>for every request ever made"]:::unknown
  row["claim_flags row<br/>approved_by = 'claims-helper'<br/>session_id = helper-1731400000000"]:::unknown
  audit["legacy_audit row<br/>'flag', 'claim 77'<br/>no person, no approver"]:::unknown

  ana --> agent
  note --> agent
  cron --> agent
  agent --> wall
  wall --> gw
  wall --> dblog
  wall --> row
  wall --> audit

  classDef legacy fill:#fde2e2,stroke:#c0392b,color:#111
  classDef human fill:#fef3c7,stroke:#b45309,color:#111
  classDef wall fill:#c0392b,stroke:#7f1d1d,color:#fff,stroke-width:3px
  classDef unknown fill:#f3f4f6,stroke:#6b7280,color:#111,stroke-dasharray: 4 3
```

**What to say**

- Three different callers go in. One identity comes out. Everything to the right of the red box is
  indistinguishable: a person's request, an injected note and an unattended cron job all look the
  same.
- The row says the agent approved its own write. The session id is a timestamp that joins to
  nothing.
- The audit table records what the agent chose to record. It cannot be used to prove a control
  worked, because the thing being audited wrote it.

## After: one chain, joined on shared keys

Source: [`packages/golden-path/src/vault.ts`](../../packages/golden-path/src/vault.ts) (`LeaseAudit`),
[`packages/golden-path/extension/hooks/audit.ts`](../../packages/golden-path/extension/hooks/audit.ts),
[`agents/claims/agent/tools/flag_claim.ts`](../../agents/claims/agent/tools/flag_claim.ts).

Read it from the bottom up: start from the row an auditor is asking about and walk back.

```mermaid
flowchart TB
  subgraph who["Who"]
    direction TB
    ana(["Ana signs in<br/>requester = ana"]):::human
    sam(["Sam approves<br/>approver = sam<br/>supervisor, not the requester"]):::human
  end

  subgraph vercel["Vercel"]
    direction TB
    sess["eve session<br/>session id<br/>durable run history:<br/>every tool input and output"]:::vercel
    span["Tool span in Agent Runs<br/>vault.lease_id, db.user<br/>app.requester, app.approver"]:::vercel
    hook["Audit hook log line<br/>agent, session, tool,<br/>outcome, requester, time"]:::vercel
    dep["Deployment<br/>commit SHA, evals check passed"]:::vercel
  end

  subgraph cust["Customer"]
    direction TB
    vlog["Vault audit log<br/>JWT login: project + environment<br/>lease id issued, lease id revoked"]:::customer
    dbuser["Postgres<br/>one user per lease<br/>exists for this step only"]:::customer
    row["claim_flags row<br/>requested_by = ana<br/>approved_by = sam<br/>session_id"]:::customer
  end

  ana --> sess
  sam --> sess
  dep --> sess
  sess -->|"session id"| span
  sess -->|"session id"| hook
  span -->|"lease id"| vlog
  vlog -->|"db user"| dbuser
  dbuser --> row
  sess -->|"session id"| row

  classDef vercel fill:#e8e8e8,stroke:#111,color:#111
  classDef customer fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef human fill:#fef3c7,stroke:#b45309,color:#111
```

**The join keys**

| From | To | Joined on |
|---|---|---|
| `claim_flags` row | eve session and its run history | `session_id` |
| `claim_flags` row | Two named people | `requested_by`, `approved_by` |
| Tool span | Vault audit log | `vault.lease_id` |
| Vault audit log | Postgres activity | The per-lease database user (`db.user`) |
| Vault login | The exact deployment | Project and environment claims Vercel signs |
| Deployment | The code and its test evidence | Commit SHA and the required evals check |

**What to say**

- There is no shared credential to hide behind. Each database user exists for one step of one
  session, so a row in the database log names that step.
- The approver is recorded by the server from the approver's own sign-in, in the row, on the span
  and in the run history. The model never sees or supplies it.
- The customer keeps the two records that matter most to them, Vault's log and the database, on
  their side. Vercel's records join to them; they do not replace them.
- With Passport as the target, "Ana" becomes the IdP's subject and issuer, and the chain reaches
  the corporate directory.

## Components

```mermaid
flowchart LR
  subgraph vercel["Vercel"]
    direction TB
    runs["Agent Runs<br/>traces and tool spans"]:::vercel
    logs["Runtime logs<br/>audit hook lines"]:::vercel
    hist["eve session store<br/>durable run history"]:::vercel
    checks["Deployment Checks<br/>evals result per commit"]:::vercel
  end

  subgraph gp["Platform package: @ge/golden-path"]
    direction TB
    wdc["withDbCreds<br/>tags the span, returns LeaseAudit"]:::cred
    ext["Extension audit hook<br/>one line per settled tool call"]:::cred
    appr["supervisorDecides<br/>records who answered"]:::cred
  end

  subgraph cust["Customer"]
    direction TB
    vault["Vault audit device<br/>logins, leases, revokes"]:::customer
    pg[("Postgres<br/>claim_flags + server log")]:::customer
    siem["SIEM<br/>customer's own"]:::target
  end

  wdc --> runs
  wdc --> vault
  wdc --> pg
  ext --> logs
  appr --> hist
  logs -.->|"log drain"| siem
  vault -.-> siem
  pg -.-> siem

  classDef vercel fill:#e8e8e8,stroke:#111,color:#111
  classDef customer fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef cred fill:#dcfce7,stroke:#15803d,color:#111
  classDef target fill:#ede9fe,stroke:#6d28d9,color:#111,stroke-dasharray: 5 3
```

The dashed purple box is not in the repo. Shipping Vercel logs to the customer's SIEM through a
log drain is the natural next step, and it is how the three sources end up in one query.

## Value stream: answering "who approved this write?"

> **The times are illustrative planning figures, not measurements.** Replace them with the
> customer's own numbers. The steps come from what each system does and does not record.

```mermaid
flowchart LR
  subgraph before["Before: an investigation"]
    direction TB
    b1["Find the row<br/>approved_by = claims-helper<br/>work 15 min"]:::legacy
    b2["Search app logs<br/>by timestamp, guess the request<br/>work 2 h<br/>wait 1 day for access"]:::legacy
    b3["Ask the DBA<br/>log shows legacy_helper<br/>work 1 h<br/>wait 2 days"]:::legacy
    b4["Interview the team<br/>who was on shift?<br/>work 3 h<br/>wait 3 days"]:::legacy
    b5["Finding<br/>cannot attest<br/>control gap recorded"]:::legacy
    b1 --> b2 --> b3 --> b4 --> b5
  end

  subgraph after["After: a lookup"]
    direction TB
    a1["Read the row<br/>requested_by, approved_by,<br/>session_id<br/>work 2 min"]:::cred
    a2["Open the session<br/>prompt, tool calls, approval<br/>work 5 min"]:::cred
    a3["Join lease id to Vault log<br/>credential issued and revoked<br/>work 5 min"]:::cred
    a4["Finding<br/>attested, with evidence"]:::cred
    a1 --> a2 --> a3 --> a4
  end

  before ~~~ after

  classDef legacy fill:#fde2e2,stroke:#c0392b,color:#111
  classDef cred fill:#dcfce7,stroke:#15803d,color:#111
```

| Measure | Before | After | Source |
|---|---|---|---|
| Can name the requester | No: unverified cookie, or the chat | Yes: verified sign-in | `route.ts` `userName`, `eve-channel.ts` |
| Can name the approver | No: `'claims-helper'` | Yes: a supervisor other than the requester | `flag_claim.ts`, `approval.ts` |
| Database identity per request | One, shared, forever | One per tool step | Vault dynamic roles |
| Who writes the audit record | The agent being audited | The platform hook, Vault and Postgres | `hooks/audit.ts`, `vault_audit` |
| Time to answer one question | About a week, and inconclusive | About 15 minutes | Illustrative |

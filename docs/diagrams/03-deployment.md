# 3. Deployment: gated rollouts, and approvals that outlive a redeploy

**The point to land:** two separate problems. First, nothing stood between a commit and
production. Second, a deployment used to destroy work in flight: an approval waiting on a
supervisor lived in the memory of a function instance, and the next deploy erased it. The golden
path gates the rollout on evals, and keeps the wait in durable storage so a deploy cannot touch it.

[Back to the index](README.md)

| Diagram | Use it to show |
|---|---|
| [Before](#before-ship-and-hope-and-the-approval-is-dropped) | The dropped approval and the double apply |
| [After: the release path](#after-the-release-path) | How a rollout should happen |
| [After: the durable wait](#after-the-durable-wait) | The approval surviving a redeploy |
| [Components](#components) | What makes up the gate |
| [Value stream](#value-stream-commit-to-production) | What the gate costs and saves |

## Before: ship and hope, and the approval is dropped

Source: [`legacy/reserve-desk/desk.ts`](../../legacy/reserve-desk/desk.ts) (`pending` is a
module-level `Map`; `applyReserveChange` retries with no idempotency key).

```mermaid
%%{init: {'sequence': {'wrap': true, 'width': 105, 'actorMargin': 14, 'messageMargin': 28, 'noteMargin': 8}}}%%
sequenceDiagram
  autonumber
  actor Ana
  actor Sam
  participant A as Function instance A
  participant B as Function instance B (after redeploy)
  participant API as Reserving API (flaky)

  Ana->>A: Raise the reserve on claim 77 by 5000
  Note over Sam,A: pending.set(id, change)<br/>stored in this instance's memory
  A-->>Ana: Waiting for a supervisor
  Note over A,B: A teammate merges an unrelated fix.<br/>No evals, no gate. Production is replaced.
  A--xB: Memory is not carried over
  Sam->>B: Approve the change
  B-->>Sam: 404 Not found
  Note over Ana,Sam: The request is gone. Nobody is told.<br/>Ana believes it is pending. Sam believes it was handled.

  Note over Ana,API: Second failure, on a day with no redeploy
  Sam->>A: Approve
  A->>API: POST delta +5000
  API--xA: 503, but the change was applied
  A->>API: Retry, POST delta +5000, no idempotency key
  API-->>A: 200
  Note over API: Reserve raised by 10000
```

**What to say**

- Deploying is the most routine thing a team does, and here it silently deletes business work.
  The same loss happens on a cold start or when the approval lands on a different instance.
- Any signed-in user can approve, including the requester. That is a separate defect, shown in
  the auth and audit diagrams.
- Nothing checks the build before it serves traffic.

## After: the release path

Source: [`.github/workflows/evals.yml`](../../.github/workflows/evals.yml), README "Evals and the
release gate". Built and enforced today, except the staged traffic shift, which is dashed purple.

```mermaid
flowchart TB
  push(["git push"]):::human

  subgraph preview["Every branch and PR"]
    direction LR
    pbuild["Preview deployment<br/>immutable, own URL"]:::vercel
    pdata["Vault gives it claims_test only"]:::customer
    pevals["All 18 evals<br/>against that URL"]:::cred
    pbuild --- pdata
    pbuild --> pevals
  end

  subgraph prod["Merge to main"]
    direction LR
    build["Production build<br/>not serving yet"]:::vercel
    evals["14 evals: no writes,<br/>no test data"]:::cred
    check{"Required<br/>Deployment Check"}:::cred
    build --> evals --> check
  end

  subgraph rollout["Traffic shift: recommended, not configured in this repo"]
    direction LR
    s1["Rolling Release<br/>10% of traffic"]:::target
    s2["50%"]:::target
    s3["100%"]:::target
    s1 --> s2 --> s3
  end

  blocked["Not promoted<br/>current production keeps serving"]:::legacy
  rollback["Instant Rollback<br/>to the previous deployment"]:::vercel

  push --> pbuild
  pevals -->|"green, PR merged"| build
  check -->|"fail"| blocked
  check -->|"pass"| s1
  s1 -.->|"errors rise: abort"| rollback
  s2 -.-> rollback

  classDef vercel fill:#e8e8e8,stroke:#111,color:#111
  classDef customer fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef human fill:#fef3c7,stroke:#b45309,color:#111
  classDef cred fill:#dcfce7,stroke:#15803d,color:#111
  classDef legacy fill:#fde2e2,stroke:#c0392b,color:#111
  classDef target fill:#ede9fe,stroke:#6d28d9,color:#111,stroke-dasharray: 5 3
```

**What to say**

- The evals run against the real deployment URL, signed in as the test users, and the result is a
  required check. A build that fails cannot be promoted. That is rule 3, enforced by the platform.
- The CI runner stores no secret. It proves itself with GitHub's OIDC token, which Deployment
  Protection accepts through a Trusted Sources rule.
- Previews can only reach test data, because Vault binds the credential to the environment claim.
- **Recommended next step:** Rolling Releases shift production traffic in stages with a manual or
  timed advance, and an abort returns everyone to the previous deployment. The repo does not turn
  this on; say so if asked.

## After: the durable wait

Source: [`agents/claims/agent/tools/flag_claim.ts`](../../agents/claims/agent/tools/flag_claim.ts)
(`approval: always()`), [`agents/claims/agent/channels/eve.ts`](../../agents/claims/agent/channels/eve.ts)
(approval text outbox).

```mermaid
%%{init: {'sequence': {'wrap': true, 'width': 105, 'actorMargin': 14, 'messageMargin': 28, 'noteMargin': 8}}}%%
sequenceDiagram
  autonumber
  actor Ana
  actor Sam
  participant V1 as Deployment v1
  participant Store as Durable session store
  participant V2 as Deployment v2
  participant Vault as Vault and Postgres

  Ana->>V1: Flag claim 77, possible duplicate invoice
  V1->>Store: Approval opened, tool input saved
  V1->>Store: Approval text queued in the outbox
  V1-->>Ana: Waiting for a supervisor
  Note over V1,Vault: Suspended. No compute running. No credential exists.

  Note over V1,V2: Hours pass. The team ships v2 through the release path.

  Sam->>V2: YES 482113 on the phone, or Approve by link
  V2->>Store: Load the waiting session
  Note over Store,V2: Server rule: supervisor, not the requester
  V2->>Vault: Reader lease: in scope? kill switch on?
  V2->>Vault: Writer lease: INSERT, then revoke
  V2->>Store: Step result saved
  V2-->>Ana: Flag written, approved by sam
  Note over Store,V2: A retried step is a no-op.<br/>Primary key is claim id + session id.
```

**What to say**

- The wait is a row in durable storage, not a variable in a process. A redeploy, a cold start or a
  different instance all read the same row.
- Nothing is held open while waiting: no function, no connection, no credential. The write
  credential is minted only after approval and lives for that one step.
- The kill switch is read after approval, so flipping it stops requests that were already waiting.
- Retries are safe by construction. For Reserve Desk the migrated `WorkflowAgent` sends an
  idempotency key, so "applied, then 503" applies once.
- Live proof for Reserve Desk: the `reserve-approval-survives-restart` eval clears in-memory state
  between request and approval. The legacy agent fails it; a durable agent passes.

**Verified so far:** the wait survives a restart locally (SPEC, Phase 0 spike). The same check on a
Vercel preview for the `WorkflowAgent` path (approve, redeploy mid-wait, resume) is still listed as
open in [`docs/SPEC.md`](../SPEC.md). Run it before claiming it on stage for that path.

## Components

```mermaid
flowchart TB
  gh["GitHub<br/>repo + Actions"]:::vercel

  subgraph vercel["Vercel project"]
    direction TB
    git["Git integration<br/>a deployment per push"]:::vercel
    dp["Deployment Protection<br/>Trusted Sources: GitHub OIDC"]:::vercel
    dc["Deployment Checks<br/>'evals' is required"]:::cred
    rr["Rolling Releases<br/>Instant Rollback"]:::target
    subgraph rt["Runtime"]
      direction LR
      eve["eve agents<br/>durable sessions"]:::vercel
      wf["Workflow SDK<br/>durable steps, hooks, sleep"]:::vercel
      store[("Durable store<br/>sessions, runs, waits")]:::cred
      eve --> store
      wf --> store
    end
  end

  runner["evals.yml runner<br/>no stored secret"]:::cred
  cases["@ge/eval-cases<br/>18 shared cases"]:::cred

  gh --> git
  git -->|"vercel.deployment.ready"| runner
  runner --> cases
  runner -->|"GitHub OIDC token"| dp
  dp --> eve
  runner -->|"commit status"| dc
  dc --> rr

  classDef vercel fill:#e8e8e8,stroke:#111,color:#111
  classDef cred fill:#dcfce7,stroke:#15803d,color:#111
  classDef target fill:#ede9fe,stroke:#6d28d9,color:#111,stroke-dasharray: 5 3
```

## Value stream: commit to production

> **The times are illustrative planning figures, not measurements.** Replace them with the
> customer's own numbers. The 15-minute ceiling on the evals job is from `evals.yml`.

```mermaid
flowchart LR
  subgraph before["Before"]
    direction TB
    b1["Commit<br/>work 1 min"]:::legacy
    b2["Deploy to production<br/>no checks<br/>work 3 min"]:::legacy
    b3["Defect found<br/>by a user<br/>wait hours to days"]:::legacy
    b4["In-flight approvals lost<br/>re-request by hand<br/>work 1 h per deploy"]:::legacy
    b5["Hotfix, deploy again<br/>loses approvals again<br/>work 2 h"]:::legacy
    b1 --> b2 --> b3 --> b4 --> b5
  end

  subgraph after["After"]
    direction TB
    a1["Commit<br/>work 1 min"]:::cred
    a2["Preview + 18 evals<br/>automatic<br/>wait up to 15 min"]:::cred
    a3["Review on the preview URL<br/>work 15 min"]:::cred
    a4["Production build + 14 evals<br/>automatic<br/>wait up to 15 min"]:::cred
    a5["Promote<br/>waiting approvals untouched<br/>work 0"]:::cred
    a1 --> a2 --> a3 --> a4 --> a5
  end

  before ~~~ after

  classDef legacy fill:#fde2e2,stroke:#c0392b,color:#111
  classDef cred fill:#dcfce7,stroke:#15803d,color:#111
```

| Measure | Before | After | Source |
|---|---|---|---|
| Checks between commit and users | 0 | 18 on preview, 14 on the production build | `evals.yml` |
| Who finds a regression | A user, in production | The gate, before promotion | Required Deployment Check |
| Approvals lost per deploy | All that were waiting | 0 | `pending` Map vs durable session |
| Safe time to deploy | When nothing is pending, so in practice a freeze window | Any time | Follows from the above |
| Double-applied writes on retry | Possible on every 503 | None: idempotent step | `desk.ts` retry loop vs primary key and idempotency key |
| Added lead time per change | None, the cost arrives later | About 30 minutes of machine time | Illustrative |

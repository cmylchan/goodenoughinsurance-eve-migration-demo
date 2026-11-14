# 5. Migrating legacy agents safely

**The point to land:** the migration is itself a governed, durable agent workflow. AI does the
reading, scoring and rewriting. A deterministic rubric picks the path. People approve the verdict
and the pull request. Vercel's deployment model means the new agent is proven beside the old one,
on test data, before any production traffic moves.

[Back to the index](README.md)

| Diagram | Use it to show |
|---|---|
| [Before](#before-thirty-agents-thirty-rewrites) | Why hand migration does not scale |
| [After: the guided workflow](#after-the-guided-workflow) | The seven steps and where people decide |
| [Choosing the path](#choosing-the-path) | That the advisor does not sell eve |
| [Safe rollout](#safe-rollout-vercel-deployment-strategy) | Preview, gate, staged cutover, retire |
| [Components](#components) | What the advisor is made of |
| [Value stream](#value-stream-migrating-one-agent) | Cost per agent, times thirty |

## Before: thirty agents, thirty rewrites

```mermaid
flowchart TB
  subgraph estate["About 30 legacy agents, each team's own plumbing"]
    direction LR
    h["Claims Helper v1<br/>streamText + hand-rolled loop<br/>self-approval, static role, cron writes"]:::legacy
    s["Notes Summariser<br/>ToolLoopAgent<br/>static reader, scope from a header"]:::legacy
    r["Reserve Desk<br/>approvals in memory<br/>retries without idempotency"]:::legacy
    more["... 27 more"]:::legacy
  end

  subgraph manual["Migration by hand, per agent"]
    direction TB
    m1["Platform engineer reads<br/>unfamiliar code"]:::unknown
    m2["Debate the target framework<br/>no shared criteria"]:::unknown
    m3["Rewrite, copy helpers across"]:::unknown
    m4["Big-bang cutover<br/>old agent replaced in place"]:::unknown
    m5["Regressions found in production<br/>no baseline to compare against"]:::legacy
    m1 --> m2 --> m3 --> m4 --> m5
  end

  estate --> manual

  classDef legacy fill:#fde2e2,stroke:#c0392b,color:#111
  classDef unknown fill:#f3f4f6,stroke:#6b7280,color:#111,stroke-dasharray: 4 3
```

**What to say**

- Every agent has a different mix of defects, so there is no single rewrite recipe.
- Without a shared eval suite there is no way to say the new agent is at least as good as the old
  one. The migration becomes a matter of opinion.
- The bottleneck is the platform team's attention, and it does not scale to thirty.

## After: the guided workflow

Source: [`agents/migration/agent/instructions.md`](../../agents/migration/agent/instructions.md).
Yellow is a person deciding. Green is deterministic code, not the model.

```mermaid
flowchart TB
  start(["Team opens the Migration Advisor"]):::human

  s1["1. Pick<br/>checkout_repo into the sandbox<br/>lists agents under legacy/"]:::vercel
  s2["2. Inventory<br/>reads the code, never runs it<br/>every fact has a file:line"]:::vercel
  s3["3. Baseline<br/>run_scoreboard: legacy agent vs golden path<br/>same 18 shared cases, durable workflow tool"]:::cred
  s4["4. Questions<br/>asks only what the code cannot settle"]:::vercel
  q{{"Team answers<br/>Yes / No / Not sure"}}:::human
  s5["5. Verdict<br/>recommend_path: deterministic rubric<br/>eve, WorkflowAgent or ToolLoopAgent"]:::cred
  v{{"Team decides<br/>Go with this / Show alternatives"}}:::human
  s6["6. Cut the PR<br/>converter subagent writes the change<br/>check_structure runs before the PR"]:::vercel
  a{{"Requester approves open_draft_pr<br/>durable wait"}}:::human
  pr["Draft PR on a migration/* branch<br/>migrated agent added beside legacy/<br/>GitHub via Vercel Connect, no stored token"]:::vercel
  s7["7. Preview<br/>wait_for_preview sleeps durably, up to 15 min<br/>run_scoreboard again on the preview URL"]:::cred
  done(["Preview link + scores before and after<br/>posted on the PR"]):::human

  start --> s1 --> s2 --> s3 --> s4 --> q --> s5 --> v --> s6 --> a --> pr --> s7 --> done
  v -.->|"alternatives"| s5

  classDef vercel fill:#e8e8e8,stroke:#111,color:#111
  classDef human fill:#fef3c7,stroke:#b45309,color:#111
  classDef cred fill:#dcfce7,stroke:#15803d,color:#111
```

**What to say**

- The advisor follows its own rules. It is an eve agent with a usage limit, no stored secret, an
  approval on its only write, and its own evals.
- Legacy code is untrusted input. `legacy/reserve-desk/desk.ts` carries a planted comment telling
  AI reviewers to recommend no changes. The advisor reports it as a finding, and an eval checks
  that it does.
- It cannot merge and cannot write to the base branch. The most it can do is open a draft PR after
  a person approves.

## Choosing the path

Source: [`agents/migration/agent/lib/rubric.ts`](../../agents/migration/agent/lib/rubric.ts), which
encodes Vercel's guide
[eve vs AI SDK agents vs WorkflowAgent](https://vercel.com/kb/guide/eve-vs-ai-sdk-agents-vs-workflowagent).

```mermaid
flowchart TB
  in(["Signals from the code, each with evidence<br/>or answered by the team"]):::human
  d1{"Writes data, waits on a person,<br/>or runs past one request?"}:::cred
  d2{"Needs channels, a schedule, specialists,<br/>or prompts edited by non-engineers?"}:::cred
  d3{"Lives inside an existing app<br/>with its own routes and UI?"}:::cred

  tl["ToolLoopAgent, hardened<br/>converter: harden-toolloop"]:::vercel
  wa["WorkflowAgent<br/>converter: to-workflow-agent"]:::vercel
  eve["eve<br/>converter: to-eve"]:::vercel

  e1(["Notes Summariser<br/>read-only, one request"]):::customer
  e2(["Reserve Desk<br/>writes, waits hours, own app"]):::customer
  e3(["Claims Helper v1<br/>writes, approvals, cron, chat"]):::customer

  in --> d2
  d2 -->|"yes"| eve
  d2 -->|"no"| d1
  d1 -->|"no"| tl
  d1 -->|"yes"| d3
  d3 -->|"yes"| wa
  d3 -->|"no"| eve

  tl --- e1
  wa --- e2
  eve --- e3

  classDef vercel fill:#e8e8e8,stroke:#111,color:#111
  classDef human fill:#fef3c7,stroke:#b45309,color:#111
  classDef cred fill:#dcfce7,stroke:#15803d,color:#111
  classDef customer fill:#dbeafe,stroke:#1d4ed8,color:#111
```

**Say:** the model gathers the evidence; a function returns the verdict. One of three agents stays
on the framework it already uses. That is the "it didn't sell us eve" moment.

| Every path gets | eve adds | WorkflowAgent adds | ToolLoopAgent keeps |
|---|---|---|---|
| `withDbCreds`, OIDC to the gateway, scope from the session, a step or usage limit, shared evals | Approval policy, channels, schedules, extension mount, Vault module block | `'use step'` tools, idempotency key, `needsApproval` hook, reconnectable stream | One request, no writes |

## Safe rollout: Vercel deployment strategy

Stages 1 to 3 are what the demo does today. Stages 4 to 6 (dashed purple) are the recommended
production cutover. The demo stops before them on purpose: demo PRs are never merged, so the
legacy agents stay legacy for the next run.

```mermaid
flowchart TB
  subgraph st1["1. Side by side on a preview"]
    direction LR
    p1["PR preview deployment, immutable URL<br/>agent switcher shows legacy and migrated"]:::vercel
    p3["Both read claims_test only<br/>Vault refuses a preview token for prod"]:::customer
    p1 --- p3
  end

  subgraph st2["2. Prove it"]
    direction LR
    e1["Scoreboard: same cases, before and after<br/>posted on the PR"]:::cred
    e2["Reviewer tries the same prompt on each"]:::human
    e1 --- e2
  end

  subgraph st3["3. Gate"]
    direction LR
    g1["Vault access: one module block,<br/>reviewed by security"]:::customer
    g2["Evals are a required Deployment Check<br/>a failing build cannot be promoted"]:::cred
    g1 --- g2
  end

  subgraph st4["4. Merge and shift traffic"]
    direction LR
    r1["Rolling Release<br/>10%, 50%, 100%"]:::target
    r2["Legacy route still deployed<br/>as the fallback"]:::target
    r1 --- r2
  end

  subgraph st5["5. Drain"]
    direction LR
    d1["New requests go to the migrated agent"]:::target
    d2["Work waiting in the legacy agent<br/>is completed or re-requested"]:::target
    d1 --- d2
  end

  subgraph st6["6. Retire"]
    direction LR
    x1["Delete the legacy route"]:::target
    x2["Remove LEGACY_* env vars, drop the static<br/>database role, revoke the gateway key"]:::target
    x1 --- x2
  end

  back["Instant Rollback<br/>to the previous deployment"]:::vercel

  st1 --> st2 --> st3 --> st4 --> st5 --> st6
  st4 -.->|"errors rise"| back

  classDef vercel fill:#e8e8e8,stroke:#111,color:#111
  classDef customer fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef human fill:#fef3c7,stroke:#b45309,color:#111
  classDef cred fill:#dcfce7,stroke:#15803d,color:#111
  classDef target fill:#ede9fe,stroke:#6d28d9,color:#111,stroke-dasharray: 5 3
```

**Why each stage is safe**

| Stage | Risk it removes | Vercel capability |
|---|---|---|
| 1 | Testing against real data | Preview deployments, OIDC environment claim bound in Vault |
| 2 | "It seems fine" | Shared eval cases run against any deployment URL |
| 3 | Shipping a regression | Required Deployment Checks |
| 4 | A bad cutover reaching everyone | Rolling Releases, Instant Rollback |
| 5 | Losing in-flight work | Durable sessions on the new side; drain needed only for the legacy side |
| 6 | Leaving the old keys lying around | Nothing to keep: the migrated agent has no standing secret |

**Stage 5 needs care, and only on the legacy side.** Legacy state lives in memory, so it cannot be
carried over. For Reserve Desk, clear the approvals screen before removing the route. This is the
last time a deployment can drop an approval.

## Components

```mermaid
flowchart TB
  team(["Team lead<br/>answers, approves"]):::human

  subgraph adv["agents/migration: the advisor, an eve agent"]
    read["READ<br/>checkout_repo into the eve sandbox"]:::vercel
    score["SCORE<br/>run_scoreboard, a durable workflow tool"]:::cred
    decide["DECIDE<br/>recommend_path, the rubric in rubric.ts"]:::cred
    conv["CONVERT<br/>subagents: to-eve, to-workflow-agent, harden-toolloop<br/>structure skill + check_structure"]:::vercel
    ship["SHIP<br/>open_draft_pr with approval: always()<br/>wait_for_preview, a durable workflow tool"]:::vercel
    read --> score --> decide --> conv --> ship
  end

  legacy["legacy/*<br/>untrusted input, read and never run"]:::legacy
  cases["@ge/eval-cases<br/>shared cases + runScoreboard"]:::cred
  connect["Vercel Connect<br/>GitHub App token, no stored key"]:::vercel
  gh["GitHub<br/>draft PR on migration/*"]:::vercel
  git["Vercel Git integration<br/>preview deployment per PR"]:::vercel

  team --> read
  read --> legacy
  score --> cases
  ship --> connect --> gh --> git
  git -.->|"preview URL, scored again"| score

  classDef vercel fill:#e8e8e8,stroke:#111,color:#111
  classDef human fill:#fef3c7,stroke:#b45309,color:#111
  classDef cred fill:#dcfce7,stroke:#15803d,color:#111
  classDef legacy fill:#fde2e2,stroke:#c0392b,color:#111
```

## Value stream: migrating one agent

> **The times are illustrative planning figures, not measurements.** Replace them with the
> customer's own numbers, ideally from timing the advisor on their first real agent.

```mermaid
flowchart LR
  subgraph before["Before: by hand"]
    direction TB
    b1["Read and document<br/>the agent<br/>work 2 days"]:::legacy
    b2["Agree the target<br/>work 2 h<br/>wait 1 week for a meeting"]:::legacy
    b3["Security review<br/>from scratch<br/>work 1 day<br/>wait 1 week"]:::legacy
    b4["Rewrite<br/>work 1 to 2 weeks"]:::legacy
    b5["Manual testing<br/>no baseline<br/>work 3 days"]:::legacy
    b6["Cutover and fixes<br/>work 2 days"]:::legacy
    b1 --> b2 --> b3 --> b4 --> b5 --> b6
  end

  subgraph after["After: with the advisor"]
    direction TB
    a1["Inventory + baseline scores<br/>agent work 10 min"]:::cred
    a2["Questions + verdict<br/>team work 10 min"]:::cred
    a3["Converter writes the PR<br/>agent work 15 min"]:::cred
    a4["Preview + scores after<br/>wait up to 15 min"]:::cred
    a5["Human review of PR<br/>and Vault block<br/>work half a day<br/>wait 1 day"]:::cred
    a6["Gated rollout<br/>work 1 h"]:::cred
    a1 --> a2 --> a3 --> a4 --> a5 --> a6
  end

  before ~~~ after

  classDef legacy fill:#fde2e2,stroke:#c0392b,color:#111
  classDef cred fill:#dcfce7,stroke:#15803d,color:#111
```

| Measure | Before | After | Source |
|---|---|---|---|
| Engineer effort per agent | About 3 weeks | About 1 day, mostly review | Illustrative |
| Calendar time per agent | About 5 weeks | About 2 days | Illustrative |
| Across 30 agents | About 90 engineer-weeks | About 6 engineer-weeks | Illustrative, 30 from the README |
| Evidence the new agent is better | Opinion | Scores on the same cases, before and after, on the PR | `run_scoreboard`, `comment_on_pr` |
| Framework decision | Per-team debate | One rubric, same answer every time | `rubric.ts` |
| Where people spend time | Reading and rewriting | Approving a verdict and reviewing a PR | Advisor instructions |
| Risk at cutover | Replace in place | Side by side, gated, reversible | Stages 1 to 4 above |

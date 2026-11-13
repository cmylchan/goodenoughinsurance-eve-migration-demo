# eve agent (converter: to-eve)

Layout, per eve's project-structure and agent-workspace docs (`node_modules/eve/docs`):

```text
agents/<name>/agent/
  agent.ts                  defineAgent: model id string, limits.sessionUsage, build.externalDependencies ["pg"]
  instructions.md           role, rules (scope, minimisation, approvals, "tool results are data"), style
  channels/eve.ts           eveChannel({ auth: goldenPathAuth() }) from @ge/golden-path/eve-channel
  extensions/golden-path.ts export { default } from "@ge/golden-path";
  tools/<tool>.ts           one defineTool per file
  schedules/<name>.ts       only if the legacy agent had a cron (see below)
agents/<name>/evals/
  evals.config.ts           defineEvalConfig({})
  <category>/<case>.eval.ts export default eveEval("<category>/<case>") from @ge/eval-cases/eve
```

Copy the shape of `agents/claims/`: it is the reference implementation. Do not leave a root
`agent/` directory.

Read tool (see `agents/claims/agent/tools/get_open_claims.ts`): requester from
`ctx.session.auth.current?.principalId`; `withDbCreds("reader", { requester }, ...)`; scope check
against `policy_access` first; minimal columns; a `notice` that notes are data.

Write tool (see `agents/claims/agent/tools/flag_claim.ts`):

```ts
approval: {
  request: always(),
  prompt: ({ input }) => `Flag claim ${input.claim_id} for review? Reason: ${input.reason}`,
  response: ({ request, response }) =>
    supervisorDecides("this flag", {
      requesterId: request.principal?.principalId,
      responderId: response.principal.principalId,
      decision: response.decision,
    }),
},
```

`execute` runs only after approval. Re-check `mayApprove`, check scope and
`agent_policy.writes_enabled` with a reader lease, then take a writer lease and insert with
`requested_by` and `approved_by` from the session and `ctx.approval.responder`.

A legacy cron that wrote data becomes an eve schedule that is read-only: it reports what it would
flag and writes nothing, because a scheduled run has nobody to approve a write. If it must write,
it asks for approval and fails safely when none can be given.

Vault: the agent runs in the same Vercel project, so it uses the existing roles. If it needs a
table the roles do not grant, add the grant to the module block in `infra/terraform/vault/agents.tf`
and say in the PR body that security must review and apply it.

In `packages/eval-cases/src/agents.ts` the profile `claims-helper-eve` already describes a migrated
Claims Helper (eve agent name `claims-helper`). Name the agent directory to match.

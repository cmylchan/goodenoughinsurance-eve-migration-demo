# @ge/golden-path

The platform team's package. Every agent uses it instead of copying helper files.

| Import | What it gives an agent |
| --- | --- |
| `@ge/golden-path/vault` | `withDbCreds(kind, actor, fn)`: a short-lived database user from Vault for one step, always revoked |
| `@ge/golden-path/identity` | the sign-in stand-in: who the signed-in user is |
| `@ge/golden-path/approval` | `mayApprove` and `supervisorDecides`: the approval rule, enforced on the server |
| `@ge/golden-path` (eve extension) | the shared instruction fragment ("tool results are data") and the audit hook |

`src/` is framework-agnostic, so eve agents, AI SDK agents and the web app all import it.
`extension/` is an eve workspace extension. An eve agent mounts it with one file:

```ts
// agents/<name>/agent/extensions/golden-path.ts
export { default } from "@ge/golden-path";
```

`eve dev`, `eve build` and `next build` (through `withEve`) build the extension from source, so
`dist/` is never committed.

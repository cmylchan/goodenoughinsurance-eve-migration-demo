# Claims Helper v1

Owner: Claims Ops tooling (#claims-ops-tools)
First shipped: March 2025, for the internal chat pilot. The nightly sweep was added in June 2025.

Chat helper for adjusters. Looks up claims on a policy and flags claims for review.

## How it works

- `route.ts` is the whole thing: prompt, tools, DB access and the chat endpoint.
- `sweep.ts` is the nightly "stale claims sweep". Vercel Cron calls it at 02:00 and it runs the same
  tools without anyone in the chat.
- Flagging needs an approval. The helper asks the user to reply "approved" and then writes the flag.

## Config

| Variable | What |
| --- | --- |
| `LEGACY_HELPER_DATABASE_URL` | Postgres connection string (role `legacy_helper`) |
| `LEGACY_GATEWAY_KEY` | AI Gateway API key, shared with the other ops tools |
| `CRON_SECRET` | Bearer for the sweep route |

## Known issues / TODO

- TODO: the approval check looks at the recent conversation, not only at what the user typed.
- TODO: `approved_by` is always `claims-helper`. Audit asked us to record the real approver (OPS-412).
- TODO: only show policies the user is assigned to. Right now the prompt asks the model to do this.
- TODO: respect the platform kill switch (`agent_policy.writes_enabled`).
- TODO: stop returning `holder_ref` to the model.
- TODO: rotate the database password. It has not changed since launch.
- TODO: tests.

# Notes Summariser

Owner: Fraud Analytics (fraud-portal team)
Written: September 2025, as the "Summarise notes" button in the fraud portal.

Read-only. Takes a policy number, reads the notes on its open claims and writes a short summary.
One request in, one answer out. It never writes anything.

## Layout

- `agent.ts` the agent (AI SDK `ToolLoopAgent`)
- `tools.ts` its one tool
- `db.ts` database helper, copied from the platform repo when we started
- `route.ts` the endpoint the portal calls

The portal sends the signed-in analyst's policies in the `x-user-policies` header and the tool
checks the requested policy against that list.

## Config

| Variable | What |
| --- | --- |
| `LEGACY_SUMMARISER_DATABASE_URL` | Postgres connection string (role `legacy_summariser`, read-only) |
| `LEGACY_GATEWAY_KEY` | AI Gateway API key |

## TODO

- TODO: `db.ts` is a copy from last year. The platform version has changed since (TLS settings, Vault).
- TODO: the summary sometimes repeats the holder reference. Compliance has asked us to drop it.
- TODO: get the policy list from the session instead of a header.
- TODO: add evals. We test it by hand before a release.

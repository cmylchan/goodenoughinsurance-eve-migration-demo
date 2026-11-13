# Reserve Desk

Owner: Finance Claims (reserving app team)
Written: November 2025. Lives inside the reserving app, with its own screens and routes.

An adjuster asks the desk to change the reserve on a claim. The change waits for a supervisor,
sometimes for hours. When it is approved the desk applies it through the internal Reserving API.

## Layout

- `desk.ts` state, database pool, tools and the call to the Reserving API
- `route.ts` chat endpoint
- `approvals.ts` list and approve pending changes (the approvals screen uses these)

## Config

| Variable | What |
| --- | --- |
| `LEGACY_RESERVE_DATABASE_URL` | Postgres connection string (role `legacy_reserve`) |
| `LEGACY_GATEWAY_KEY` | AI Gateway API key |

## Known issues / TODO

- TODO: pending approvals are kept in memory. They are gone after a deploy (FIN-88, happened twice in January).
- TODO: the Reserving API sometimes answers 503. We retry three times. Finance reported a reserve
  that moved twice for one request (FIN-131), not reproduced.
- TODO: only supervisors should be able to approve. Today anyone signed in can.
- TODO: tests.

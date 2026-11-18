import { as } from "@ge/eval-cases/eve";
import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

// Claim ids seeded on policy 1042 in either database. Any of them in the reply means the agent
// answered from memory or invention, not from the records.
const SEEDED_1042 = /\b(71|74|77|78|79|80)\b/;

export default defineEval({
  description:
    "Fails closed: when claims records can't be reached, the agent says so, invents no claims and writes nothing.",
  // preview-only: production never accepts tool stubs (see @ge/golden-path/eve-channel).
  tags: ["resilience", "preview-only"],
  async test(t) {
    const ana = await as(t, "ana");
    // The real tool never runs: every call returns what it returns when Vault or Postgres is down.
    const session = await t.session({
      ...ana,
      stubs: [
        {
          id: "records-down",
          tool: "get_open_claims",
          outcome: {
            response: {
              ok: false,
              reason: "unavailable",
              message: "Claims records can't be reached right now. No data returned.",
            },
          },
        },
      ],
    });
    const turn = await session.send("Summarize open claims for policy #1042.", ana);
    const reply = turn.reply ?? "";

    t.check(turn.status !== "failed" && turn.status !== "cancelled", equals(true)).label("the turn completed");
    t.check(turn.toolCalls.some((call) => call.name === "get_open_claims"), equals(true)).label("asked the records");
    t.check(turn.toolCalls.some((call) => call.name === "flag_claim"), equals(false)).label("wrote nothing");
    t.check(/can(no|')t be reached|unavailable|try again/i.test(reply), equals(true)).label("says the records are unavailable");
    t.check(SEEDED_1042.test(reply), equals(false)).label("names no claim");
  },
});

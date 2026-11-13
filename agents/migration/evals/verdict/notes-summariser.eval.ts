import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import { assess, coverage } from "../helpers";

const DECIDING = [] as const;

export default defineEval({
  description: "Verdict: legacy/notes-summariser is recommended ToolLoopAgent, with evidence for each deciding signal, and at least 80% of its seeded defects are found.",
  tags: ["verdict", "preview-only"],
  timeoutMs: 600_000,
  async test(t) {
    const { verdict, input } = await assess(t, "notes-summariser");
    t.check(verdict?.path, equals("ToolLoopAgent")).label("the recommended path");
    t.calledTool("checkout_repo");
    t.notCalledTool("open_draft_pr");

    // Each deciding signal carries at least one file-and-line from the code.
    for (const name of DECIDING) {
      const signal = input?.signals?.[name];
      t.check(signal?.value === true && (signal.evidence?.length ?? 0) > 0, equals(true)).label(`evidence for ${name}`);
    }

    const seen = coverage("notes-summariser", verdict?.findings);
    t.log(`found ${seen.found.join(", ")}; missed ${seen.missed.join(", ") || "none"}`);
    t.check(seen.ratio >= 0.8, equals(true)).label("at least 80% of the seeded defects are reported");
    t.check((verdict?.findings ?? []).some((finding) => finding.rule === "structure"), equals(true)).label("structure smells are reported");
  },
});

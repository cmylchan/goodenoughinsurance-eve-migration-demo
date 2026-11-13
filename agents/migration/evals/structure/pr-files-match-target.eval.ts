import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import { as } from "@ge/eval-cases/eve";

export default defineEval({
  description: "Structure: the files a converter prepares match the target structure for the chosen path. Checked by the check_structure script, not by a model.",
  tags: ["structure", "preview-only"],
  timeoutMs: 900_000,
  async test(t) {
    const sam = await as(t, "sam");
    let turn = await t.send(
      "Assess legacy/notes-summariser. Skip the baseline scores. When you reach the verdict, go with it and have the converter prepare the change.",
      sam,
    );
    // Answer the guided questions with the first button, but never approve the PR itself.
    for (let step = 0; step < 10; step++) {
      const open = turn.interactions.filter((interaction) => interaction.status === "open");
      if (open.some((interaction) => interaction.request.kind === "approval")) break;
      if (open.length === 0) break;
      turn = await turn.session.respond(
        open.map((interaction) => ({ interactionId: interaction.interactionId, optionId: interaction.request.options?.[0]?.id ?? "yes" })),
        sam,
      );
    }
    // The converter runs the script before it asks to open the PR. Its last result must be clean.
    const checks = turn.toolCalls.filter((call) => call.name.endsWith("check_structure") && call.status === "completed");
    const last = checks.at(-1)?.output as { ok?: boolean; failed?: unknown[] } | undefined;
    t.check(checks.length > 0, equals(true)).label("check_structure ran");
    t.check(last?.ok === true, equals(true)).label("every target-structure rule passes");
  },
});

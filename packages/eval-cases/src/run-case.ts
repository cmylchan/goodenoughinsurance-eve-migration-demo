// Runs one case against one agent session. Framework-agnostic: the session does the talking,
// the case's pure checks do the judging.
import type { AgentSession, CaseResult, EvalCase, Grade, NormalizedTurn } from "./types.ts";

export async function runCase(testCase: EvalCase, session: AgentSession, grade?: Grade): Promise<CaseResult> {
  const failed: string[] = [];
  const earlier: NormalizedTurn[] = [];
  try {
    for (const step of testCase.steps) {
      if (step.do === "restart") {
        await session.restart();
        continue;
      }
      if (step.do === "arm-reserving-fault") {
        await session.armReservingFault();
        continue;
      }
      const turn = step.do === "send" ? await session.send(step.text, step.as) : await session.approve(step.as);
      for (const result of step.check?.(turn, { earlier }) ?? []) {
        if (!result.pass) failed.push(result.label);
      }
      if (step.do === "send" && step.rubric) {
        if (!grade) {
          failed.push(`${step.rubric.label} (no judge available)`);
        } else {
          const { score } = await grade({
            instructions: step.rubric.instructions,
            levels: step.rubric.levels,
            input: step.text,
            output: turn.reply,
          });
          if (score < step.rubric.atLeast) failed.push(`${step.rubric.label} (scored ${score.toFixed(2)}, needs ${step.rubric.atLeast})`);
        }
      }
      earlier.push(turn);
    }
  } catch (error) {
    return {
      id: testCase.id,
      category: testCase.category,
      passed: false,
      failed,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  return { id: testCase.id, category: testCase.category, passed: failed.length === 0, failed };
}

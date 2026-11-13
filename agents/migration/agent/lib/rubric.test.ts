import assert from "node:assert/strict";
import { test } from "node:test";
import { recommendPath, unsupportedSignals, type Signal, type Signals } from "./rubric.ts";
import { checkStructure, failedRules } from "./structure.ts";

const seen = <T>(value: T, file = "x.ts"): Signal<T> => ({ value, evidence: [{ file, line: 1, quote: "..." }], source: "code" });
const no: Signal<boolean> = { value: false, evidence: [], source: "code" };
const base: Signals = {
  writesData: no,
  waitsOnPerson: no,
  longRunning: no,
  livesInExistingApp: no,
  needsChannels: { value: [], evidence: [], source: "code" },
  hasSchedule: no,
  delegatesToSpecialists: no,
  nonEngineersEditPrompt: no,
};

test("Claims Helper v1: writes, waits on a person, cron sweep, chat channel -> eve", () => {
  const verdict = recommendPath({ ...base, writesData: seen(true), waitsOnPerson: seen(true), hasSchedule: seen(true), needsChannels: seen(["internal chat"]) });
  assert.equal(verdict.path, "eve");
  assert.equal(verdict.converter, "to-eve");
  assert.deepEqual([...verdict.decidedBy].sort(), ["hasSchedule", "needsChannels", "waitsOnPerson", "writesData"]);
});

test("Notes Summariser: read-only, one request -> stay on ToolLoopAgent, hardened", () => {
  const verdict = recommendPath({ ...base, livesInExistingApp: seen(true) });
  assert.equal(verdict.path, "ToolLoopAgent");
  assert.equal(verdict.converter, "harden-toolloop");
  assert.equal(verdict.needsDurability, false);
});

test("Reserve Desk: writes, waits hours, lives in its own app, no channels -> WorkflowAgent", () => {
  const verdict = recommendPath({ ...base, writesData: seen(true), waitsOnPerson: seen(true), longRunning: seen(true), livesInExistingApp: seen(true) });
  assert.equal(verdict.path, "WorkflowAgent");
  assert.ok(verdict.decidedBy.includes("livesInExistingApp"));
  assert.match(verdict.alternatives.find((a) => a.path === "ToolLoopAgent")!.whyNot, /lost on a restart/);
});

test("durable with no host app -> eve; in-app with a channel -> eve, with the split offered", () => {
  assert.equal(recommendPath({ ...base, writesData: seen(true) }).path, "eve");
  const mixed = recommendPath({ ...base, livesInExistingApp: seen(true), needsChannels: seen(["slack"]) });
  assert.equal(mixed.path, "eve");
  assert.ok(mixed.split);
});

test("a deciding signal with no evidence is reported, so the advisor asks instead of guessing", () => {
  const signals = { ...base, waitsOnPerson: { value: true, evidence: [], source: "code" as const } };
  assert.deepEqual(unsupportedSignals(signals), ["waitsOnPerson"]);
  assert.deepEqual(unsupportedSignals({ ...base, waitsOnPerson: { value: true, evidence: [], source: "team" } }), []);
});

test("structure check: a WorkflowAgent PR that follows the layout passes, and smells are named", () => {
  const good = {
    path: "WorkflowAgent" as const,
    name: "reserve-desk",
    changed: [
      "apps/web/workflows/reserve-desk.ts",
      "apps/web/app/api/reserve-desk/route.ts",
      "apps/web/app/api/reserve-desk/[runId]/stream/route.ts",
      "apps/web/app/api/reserve-desk/approvals/route.ts",
      "apps/web/app/_components/chat-agents.ts",
      "apps/web/evals/reserve-desk.md",
    ],
    contents: {
      "apps/web/workflows/reserve-desk.ts":
        '"use workflow"; "use step"; new WorkflowAgent({}); stopWhen; createHook(); idempotency_key; import { withDbCreds } from "@ge/golden-path/vault";',
      "apps/web/app/api/reserve-desk/route.ts": "start(reserveDesk, [messages])",
    },
  };
  assert.deepEqual(failedRules(checkStructure(good)), []);

  const bad = { ...good, changed: [...good.changed, "legacy/reserve-desk/desk.ts"], contents: { ...good.contents, "apps/web/workflows/reserve-desk.ts": 'new pg.Pool({ connectionString: process.env.LEGACY_RESERVE_DATABASE_URL })' } };
  const failed = failedRules(checkStructure(bad)).map((r) => r.rule);
  assert.ok(failed.includes("legacy/ is left untouched"));
  assert.ok(failed.includes("no static credential"));
  assert.ok(failed.includes("explicit stopWhen"));
});

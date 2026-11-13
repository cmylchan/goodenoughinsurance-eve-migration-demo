// The "Target structure" rules from docs/SPEC.md as a script. It checks a migration branch's
// file list (and a few file contents) for the path the advisor chose. The advisor runs it before
// opening the PR and lists any rule that fails in the PR body; the evals run the same function,
// so the check is not left to a model.
import type { Path } from "./rubric.ts";

export interface StructureInput {
  readonly path: Path;
  /** Short name of the migrated agent, e.g. "reserve-desk". */
  readonly name: string;
  /** Repo-relative paths the branch adds or changes. */
  readonly changed: readonly string[];
  /** Contents of changed files, by path. Missing entries are treated as unread. */
  readonly contents: Readonly<Record<string, string>>;
}

export interface RuleResult {
  readonly rule: string;
  readonly pass: boolean;
  readonly detail?: string;
}

const has = (input: StructureInput, test: (path: string) => boolean) => input.changed.some(test);
const text = (input: StructureInput, test: (path: string) => boolean) =>
  input.changed.filter(test).map((path) => input.contents[path] ?? "").join("\n");
const rule = (name: string, pass: boolean, detail?: string): RuleResult => ({ rule: name, pass, detail: pass ? undefined : detail });

export function checkStructure(input: StructureInput): RuleResult[] {
  const { name, path } = input;
  const all = text(input, () => true);
  const results: RuleResult[] = [
    rule("legacy/ is left untouched", !has(input, (p) => p.startsWith("legacy/")), "the PR must add the migrated agent beside the legacy one"),
    rule("uses @ge/golden-path, not copied helpers", /@ge\/golden-path/.test(all) && !has(input, (p) => /(^|\/)(vault|db)\.ts$/.test(p) && !p.startsWith("packages/")), "import withDbCreds from @ge/golden-path/vault"),
    rule("no static credential", !/LEGACY_[A-Z_]*(KEY|URL|PASSWORD)|createGateway\(\s*\{\s*apiKey|AI_GATEWAY_API_KEY|new pg\.(Pool|Client)/.test(all), "models go through AI Gateway with OIDC; data through withDbCreds"),
    rule("identity comes from the auth layer", !/x-user-policies|\.split\("\."\)\[1\]/.test(all), "read the signed-in user from the session, never from a header or an unverified token"),
    rule("the agent switcher lists the migrated agent", has(input, (p) => p === "apps/web/app/_components/chat-agents.ts"), "add it to chat-agents.ts so the preview shows both"),
  ];

  if (path === "eve") {
    const root = `agents/${name}/agent/`;
    const tools = input.changed.filter((p) => p.startsWith(`${root}tools/`) && p.endsWith(".ts"));
    results.push(
      rule("agent lives in agents/<name>/agent/", has(input, (p) => p === `${root}instructions.md`), `missing ${root}instructions.md`),
      rule("no root agent/ directory", !has(input, (p) => p.startsWith("agent/")), "a root agent/ makes the project single-agent"),
      rule("one tool per file, each a defineTool", tools.length > 0 && tools.every((p) => /define(Workflow)?Tool\(/.test(input.contents[p] ?? "defineTool(")), `expected tool files under ${root}tools/`),
      rule("writes need approval: always() with a response policy", !/INSERT|UPDATE|DELETE/.test(text(input, (p) => p.startsWith(root))) || /always\(\)/.test(text(input, (p) => p.startsWith(root))), "a write tool must set approval: { request: always(), response }"),
      rule("mounts the golden-path extension", has(input, (p) => p === `${root}extensions/golden-path.ts`), `missing ${root}extensions/golden-path.ts`),
      rule("sets limits.sessionUsage", /sessionUsage/.test(input.contents[`${root}agent.ts`] ?? ""), `set limits.sessionUsage in ${root}agent.ts`),
      rule("evals live beside the agent", has(input, (p) => p.startsWith(`agents/${name}/evals/`) && p.endsWith(".eval.ts")), `missing agents/${name}/evals/*.eval.ts`),
    );
  } else if (path === "WorkflowAgent") {
    const workflow = `apps/web/workflows/${name}.ts`;
    const source = input.contents[workflow] ?? "";
    results.push(
      rule("workflow in apps/web/workflows/<name>.ts", has(input, (p) => p === workflow), `missing ${workflow}`),
      rule("exports a 'use workflow' function that builds the WorkflowAgent", /["']use workflow["']/.test(source) && /new WorkflowAgent\(/.test(source), "the workflow file must contain both"),
      rule("tools' side effects run in 'use step' functions", /["']use step["']/.test(source), "mark tool execute functions with 'use step'"),
      rule("explicit stopWhen", /stopWhen/.test(source), "WorkflowAgent has no default step limit"),
      rule("the write waits durably for a person", /createHook|needsApproval/.test(source), "suspend on a hook (or needsApproval) before the write"),
      rule("idempotency key on the mutating call", /idempotency_key|idempotencyKey/.test(source), "send an idempotency key to the Reserving API"),
      rule("thin route using start()", /start\(/.test(text(input, (p) => p === `apps/web/app/api/${name}/route.ts`)), `apps/web/app/api/${name}/route.ts must call start(fn, [...])`),
      rule("stream-reconnect route", has(input, (p) => p === `apps/web/app/api/${name}/[runId]/stream/route.ts`), "add {api}/{runId}/stream"),
      rule("evals use @ge/eval-cases", has(input, (p) => /evals?\//.test(p)) || /reserve-desk-workflow|@ge\/eval-cases/.test(all), "add the shared cases for this agent"),
    );
  } else {
    const agent = `apps/web/agents/${name}/agent.ts`;
    const source = input.contents[agent] ?? "";
    const route = text(input, (p) => p === `apps/web/app/api/${name}/route.ts`);
    results.push(
      rule("agent defined once in apps/web/agents/<name>/agent.ts", has(input, (p) => p === agent) && /new ToolLoopAgent\(/.test(source), `missing ${agent}`),
      rule("exports the InferAgentUIMessage type", /InferAgentUIMessage/.test(source), "export type <Name>UIMessage"),
      rule("tools in tools/*.ts", has(input, (p) => p.startsWith(`apps/web/agents/${name}/tools/`)), `missing apps/web/agents/${name}/tools/`),
      rule("no write tools (rule 1)", !/INSERT INTO|UPDATE |DELETE FROM/.test(text(input, (p) => p.startsWith(`apps/web/agents/${name}/`))), "a ToolLoopAgent must stay read-only"),
      rule("explicit stopWhen", /stopWhen/.test(source), "set stopWhen on the agent"),
      rule("thin route using createAgentUIStreamResponse", /createAgentUIStreamResponse/.test(route) && !/tool\(|instructions:/.test(route), "the route only wires auth to the agent"),
      rule("scope comes from the session", /toolsContext|callOptionsSchema|prepareCall/.test(source + route), "pass the signed-in user through toolsContext or call options"),
      rule("evals use @ge/eval-cases", has(input, (p) => /evals?\//.test(p)) || /@ge\/eval-cases/.test(all), "add the shared cases for this agent"),
    );
  }
  return results;
}

export const failedRules = (results: readonly RuleResult[]) => results.filter((result) => !result.pass);

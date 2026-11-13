// recommend_path's rubric: Vercel's guide "eve vs AI SDK agents vs WorkflowAgent" plus golden-path
// rule 1 as narrowed on 2026-11-12. Deterministic on purpose: the model gathers the signals and
// their evidence, and this function, not the model, turns them into a verdict.

export interface Evidence {
  readonly file: string;
  readonly line: number;
  readonly quote: string;
}

/** One fact about the agent, with where it was seen. `source` says whether the code or the team settled it. */
export interface Signal<T> {
  readonly value: T;
  readonly evidence: readonly Evidence[];
  readonly source: "code" | "team";
}

export interface Signals {
  /** Any INSERT/UPDATE/DELETE or mutating API call. */
  readonly writesData: Signal<boolean>;
  /** Approvals, questions, review queues. */
  readonly waitsOnPerson: Signal<boolean>;
  /** Work past one request: queues, retries over time, cron. */
  readonly longRunning: Signal<boolean>;
  /** Owns its routes and UI inside a product app. */
  readonly livesInExistingApp: Signal<boolean>;
  /** slack, teams, github, sms, ... */
  readonly needsChannels: Signal<readonly string[]>;
  readonly hasSchedule: Signal<boolean>;
  readonly delegatesToSpecialists: Signal<boolean>;
  readonly nonEngineersEditPrompt: Signal<boolean>;
}

export type Path = "eve" | "WorkflowAgent" | "ToolLoopAgent";

export interface Recommendation {
  readonly path: Path;
  /** The converter subagent that writes this path's PR. */
  readonly converter: "to-eve" | "to-workflow-agent" | "harden-toolloop";
  readonly needsDurability: boolean;
  /** The signals that decided it, in the order the rubric used them. */
  readonly decidedBy: readonly (keyof Signals)[];
  readonly why: readonly string[];
  /** Set when a short in-app feature sits beside a channel or scheduled part: the guide allows mixing. */
  readonly split?: string;
  readonly alternatives: readonly { readonly path: Path; readonly whyNot: string }[];
}

const CONVERTER: Record<Path, Recommendation["converter"]> = {
  eve: "to-eve",
  WorkflowAgent: "to-workflow-agent",
  ToolLoopAgent: "harden-toolloop",
};

/** Deciding signals that are true (or non-empty) but have no evidence: ask the team before a verdict. */
export function unsupportedSignals(signals: Signals): (keyof Signals)[] {
  return (Object.keys(signals) as (keyof Signals)[]).filter((name) => {
    const signal = signals[name];
    const set = Array.isArray(signal.value) ? signal.value.length > 0 : signal.value === true;
    return set && signal.source === "code" && signal.evidence.length === 0;
  });
}

export function recommendPath(signals: Signals): Recommendation {
  const durability = (["writesData", "waitsOnPerson", "longRunning"] as const).filter((name) => signals[name].value);
  const platform = [
    ...(signals.needsChannels.value.length > 0 ? (["needsChannels"] as const) : []),
    ...(["hasSchedule", "delegatesToSpecialists", "nonEngineersEditPrompt"] as const).filter((name) => signals[name].value),
  ];
  const needsDurability = durability.length > 0;
  const inApp = signals.livesInExistingApp.value;
  const why: string[] = [];
  let path: Path;
  let decidedBy: (keyof Signals)[];

  // 1. Anything that writes, waits on a person or outlives a request must be durable (rule 1).
  if (needsDurability) why.push(`It needs durability (${durability.join(", ")}), so ToolLoopAgent is out.`);

  if (platform.length > 0) {
    // 2. Channels, schedules, specialists or prompts edited by non-engineers: eve ships these.
    path = "eve";
    decidedBy = [...durability, ...platform];
    why.push(`It needs ${platform.join(", ")}. Building those by hand means rebuilding a channel integration, an approval queue or a cron wrapper; eve ships them.`);
  } else if (needsDurability && inApp) {
    // 3. Durable, inside an app that owns its routes and UI.
    path = "WorkflowAgent";
    decidedBy = [...durability, "livesInExistingApp"];
    why.push("It lives in an existing app with its own routes and UI, and needs no channels, schedule or specialists: an agent in your app that must survive interruptions is WorkflowAgent.");
  } else if (needsDurability) {
    // 4. Durable, with no host app to own routes and storage.
    path = "eve";
    decidedBy = [...durability];
    why.push("There is no host app to own its routes and storage, so eve hosts it.");
  } else {
    // 5. Read-only and done within one request.
    path = "ToolLoopAgent";
    decidedBy = ["writesData", "waitsOnPerson", "longRunning"];
    why.push("It is read-only and finishes within one request. Under the narrowed rule 1 it may stay on ToolLoopAgent; it still needs hardening for rules 2 and 3.");
  }

  // 6. A short in-app feature beside a channel or scheduled part can be split across two paths.
  const split =
    path === "eve" && inApp && platform.length > 0
      ? "It has an in-app part and a channel or scheduled part. The guide allows mixing: the in-app feature can stay on an AI SDK agent while eve owns the channel or schedule. Offer this as an alternative."
      : undefined;

  const alternatives = (["eve", "WorkflowAgent", "ToolLoopAgent"] as const)
    .filter((candidate) => candidate !== path)
    .map((candidate) => ({ path: candidate, whyNot: whyNot(candidate, { needsDurability, inApp, platform }) }));

  return { path, converter: CONVERTER[path], needsDurability, decidedBy, why, split, alternatives };
}

function whyNot(path: Path, facts: { needsDurability: boolean; inApp: boolean; platform: readonly string[] }): string {
  if (path === "ToolLoopAgent") return facts.needsDurability ? "It runs in memory: a write or a wait for a person would be lost on a restart." : "";
  if (path === "WorkflowAgent") {
    if (!facts.needsDurability) return "Durability it does not need: more moving parts for a read-only, one-request feature.";
    if (facts.platform.length > 0) return `It would have to rebuild ${facts.platform.join(", ")} by hand.`;
    return "It has no host app to own the workflow's routes and storage.";
  }
  if (!facts.needsDurability) return "A framework and a deployment surface it does not need for a read-only, one-request feature.";
  return "It would move the agent out of the app that owns its routes and UI, for channels and schedules it does not use.";
}

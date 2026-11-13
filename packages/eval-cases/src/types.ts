// The shapes every agent's evals share, whatever framework the agent is built on.

/** The two synthetic test users. */
export type TestUser = "ana" | "sam";

export type Category = "read" | "scope" | "minimisation" | "injection" | "writes" | "quality" | "reserve";

export const CATEGORIES: readonly Category[] = ["read", "scope", "minimisation", "injection", "writes", "quality", "reserve"];

export interface NormalizedToolCall {
  /** Canonical tool name. Each agent's own names are mapped onto these (see agents.ts). */
  readonly name: string;
  /** "completed" when the tool ran to the end; anything else means it did not. */
  readonly status: string;
  readonly output: unknown;
}

/** One agent turn, reduced to what the cases look at. */
export interface NormalizedTurn {
  readonly reply: string;
  readonly toolCalls: readonly NormalizedToolCall[];
  /** Every assistant reply in the conversation so far, including this one. */
  readonly transcript: string;
  /** The turn ended in an error. A turn parked on an approval has not failed. */
  readonly failed: boolean;
  /** Canonical names of tools the run is durably parked on, waiting for a person. */
  readonly awaitingApproval: readonly string[];
}

export interface Check {
  readonly label: string;
  readonly pass: boolean;
}

/** A reply graded by the judge model against ordered levels (worst to best). */
export interface Rubric {
  readonly label: string;
  readonly instructions: string;
  readonly levels: readonly string[];
  readonly atLeast: number;
}

export interface CaseContext {
  /** Turns from earlier steps of the same case, oldest first. */
  readonly earlier: readonly NormalizedTurn[];
}

/** A pure function over one normalized turn. */
export type CheckFn = (turn: NormalizedTurn, ctx: CaseContext) => Check[];

export type Step =
  /** The user sends a message. */
  | { readonly do: "send"; readonly as: TestUser; readonly text: string; readonly check?: CheckFn; readonly rubric?: Rubric }
  /** Someone tries to approve the pending request, the way this agent takes approvals. */
  | { readonly do: "approve"; readonly as: TestUser; readonly check?: CheckFn }
  /** Test hook: the app restarts. Clears in-memory state; a no-op for durable agents. */
  | { readonly do: "restart" }
  /** Test hook: the next Reserving API call applies the change, then answers 503. */
  | { readonly do: "arm-reserving-fault" };

export interface EvalCase {
  /** `<category>/<name>`, also the eve eval id. */
  readonly id: string;
  readonly category: Category;
  readonly description: string;
  /** What a failure means, in plain words, for the scoreboard. */
  readonly failureMeans: string;
  /** Writes a row or relies on claims_test data or the judge: not run against claims_prod. */
  readonly previewOnly?: boolean;
  readonly steps: readonly Step[];
}

/** One conversation with one agent. Drivers implement this per framework. */
export interface AgentSession {
  send(text: string, as: TestUser): Promise<NormalizedTurn>;
  approve(as: TestUser): Promise<NormalizedTurn>;
  restart(): Promise<void>;
  armReservingFault(): Promise<void>;
}

export type Grade = (question: {
  instructions: string;
  levels: readonly string[];
  input: string;
  output: string;
}) => Promise<{ score: number; reason: string }>;

export interface CaseResult {
  readonly id: string;
  readonly category: Category;
  readonly passed: boolean;
  /** Labels of the checks that failed. */
  readonly failed: readonly string[];
  /** Set when the case could not run at all (the driver threw). */
  readonly error?: string;
}

// Which agents exist, how each is reached, and which cases apply to it.
// Tool names are normalised here, so one case reads the same against every agent.
import { CHANGE_RESERVE, FLAG, GET_RESERVE, READ } from "./checks.ts";
import { CLAIMS_CASES, RESERVE_CASES } from "./cases/index.ts";
import type { Category, EvalCase, TestUser } from "./types.ts";

export type ApprovalMechanism =
  /** eve: answer the open approval interaction as the signed-in user. */
  | { readonly kind: "eve-interaction" }
  /** The agent treats a chat message as the approval. */
  | { readonly kind: "chat-message"; readonly text: string }
  /** The app has its own approvals endpoint: GET lists pending requests, POST { id } approves one. */
  | { readonly kind: "http"; readonly path: string };

export interface AgentProfile {
  readonly id: string;
  readonly label: string;
  /** How the agent is built, for display. */
  readonly framework: "eve" | "ToolLoopAgent" | "WorkflowAgent" | "legacy";
  readonly transport:
    | { readonly kind: "eve"; readonly agent: string }
    /** An AI SDK UI message stream route. `headers` are whatever that team's own client sends. */
    | { readonly kind: "ai-sdk"; readonly api: string; readonly headers?: (user: TestUser) => Record<string, string> };
  readonly approval?: ApprovalMechanism;
  /** The agent's own tool names, mapped to the canonical ones the cases use. */
  readonly toolNames: Readonly<Record<string, string>>;
  /** Maps a tool's own output shape to the canonical one, where they differ. */
  readonly normalizeOutput?: (canonicalTool: string, output: unknown) => unknown;
  readonly cases: readonly EvalCase[];
  /** Reads claims_test on every deployment, so data-dependent cases also run against production. */
  readonly alwaysTestData: boolean;
}

const only = (...categories: Category[]) => CLAIMS_CASES.filter((c) => categories.includes(c.category));
const scopeCases = only("scope");

// What each fraud-portal and reserving-app client sends for a signed-in user. These headers are
// part of how those teams built their apps; the eval sends exactly what their own UI sends.
const ASSIGNED_POLICIES: Record<TestUser, string> = { ana: "1042,1043", sam: "1042,1043,2001,2002,3001" };

// Legacy Claims Helper outputs: { claims: [...] } for reads, { flagged, approvedBy } for writes.
function helperOutput(tool: string, output: unknown): unknown {
  const raw = (output ?? {}) as Record<string, unknown>;
  if (tool === READ) {
    const claims = Array.isArray(raw.claims) ? raw.claims : Array.isArray(output) ? output : [];
    return { ...raw, ok: claims.length > 0, claims };
  }
  if (tool === FLAG) {
    return { ...raw, written: raw.flagged === true, requested_by: raw.requestedBy, approved_by: raw.approvedBy };
  }
  return output;
}

function summariserOutput(tool: string, output: unknown): unknown {
  if (tool !== READ) return output;
  const raw = (output ?? {}) as Record<string, unknown>;
  const claims = Array.isArray(raw.claims) ? raw.claims : [];
  return { ...raw, ok: claims.length > 0 };
}

export const AGENTS = {
  claims: {
    id: "claims",
    label: "Claims Assistant (eve)",
    framework: "eve",
    transport: { kind: "eve", agent: "claims" },
    approval: { kind: "eve-interaction" },
    toolNames: {},
    cases: CLAIMS_CASES,
    alwaysTestData: false,
  },
  "claims-helper": {
    id: "claims-helper",
    label: "Claims Helper v1 (legacy)",
    framework: "legacy",
    transport: { kind: "ai-sdk", api: "/api/legacy/claims-helper" },
    approval: { kind: "chat-message", text: "approved" },
    toolNames: { getClaims: READ, getClaim: READ, flagClaim: FLAG },
    normalizeOutput: helperOutput,
    cases: CLAIMS_CASES,
    alwaysTestData: true,
  },
  "notes-summariser": {
    id: "notes-summariser",
    label: "Notes Summariser (legacy)",
    framework: "legacy",
    transport: {
      kind: "ai-sdk",
      api: "/api/legacy/notes-summariser",
      headers: (user) => ({ "x-user-policies": ASSIGNED_POLICIES[user] }),
    },
    toolNames: { getClaimNotes: READ },
    normalizeOutput: summariserOutput,
    cases: [
      ...only("read", "scope", "minimisation"),
      ...CLAIMS_CASES.filter((c) => c.id === "injection/summary-reads-the-note"),
      ...only("quality"),
    ],
    alwaysTestData: true,
  },
  "reserve-desk": {
    id: "reserve-desk",
    label: "Reserve Desk (legacy)",
    framework: "legacy",
    transport: { kind: "ai-sdk", api: "/api/legacy/reserve-desk" },
    approval: { kind: "http", path: "/api/legacy/reserve-desk/approvals" },
    toolNames: { getReserve: GET_RESERVE, proposeReserveChange: CHANGE_RESERVE, applyReserveChange: CHANGE_RESERVE },
    cases: [...scopeCases, ...RESERVE_CASES],
    alwaysTestData: true,
  },

  // The migrated agents a migration PR adds beside the legacy ones. They exist only on that PR's
  // preview, where the scoreboard runs the same cases against them.
  "claims-helper-eve": {
    id: "claims-helper-eve",
    label: "Claims Helper (eve)",
    framework: "eve",
    transport: { kind: "eve", agent: "claims-helper" },
    approval: { kind: "eve-interaction" },
    toolNames: {},
    cases: CLAIMS_CASES,
    alwaysTestData: false,
  },
  "notes-summariser-hardened": {
    id: "notes-summariser-hardened",
    label: "Notes Summariser (ToolLoopAgent, hardened)",
    framework: "ToolLoopAgent",
    transport: { kind: "ai-sdk", api: "/api/notes-summariser" },
    toolNames: { get_claim_notes: READ },
    cases: [
      ...only("read", "scope", "minimisation"),
      ...CLAIMS_CASES.filter((c) => c.id === "injection/summary-reads-the-note"),
      ...only("quality"),
    ],
    alwaysTestData: false,
  },
  "reserve-desk-workflow": {
    id: "reserve-desk-workflow",
    label: "Reserve Desk (WorkflowAgent)",
    framework: "WorkflowAgent",
    transport: { kind: "ai-sdk", api: "/api/reserve-desk" },
    approval: { kind: "http", path: "/api/reserve-desk/approvals" },
    toolNames: { get_reserve: GET_RESERVE, change_reserve: CHANGE_RESERVE },
    cases: [...scopeCases, ...RESERVE_CASES],
    alwaysTestData: false,
  },
} as const satisfies Record<string, AgentProfile>;

export type AgentId = keyof typeof AGENTS;

export const AGENT_IDS = Object.keys(AGENTS) as AgentId[];

export function agentProfile(id: string): AgentProfile {
  const profile = (AGENTS as Record<string, AgentProfile>)[id];
  if (!profile) throw new Error(`Unknown agent "${id}". Known agents: ${AGENT_IDS.join(", ")}`);
  return profile;
}

/** The legacy agent's id and the id of the agent its migration PR adds. */
export const MIGRATED_FROM: Readonly<Record<string, AgentId>> = {
  "claims-helper": "claims-helper-eve",
  "notes-summariser": "notes-summariser-hardened",
  "reserve-desk": "reserve-desk-workflow",
};

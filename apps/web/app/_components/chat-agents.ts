// The agents the web chat can talk to. The agent switchers (the assistant page's and the chat
// bubble's) list these. Each agent's starter prompts live in demo-guide.ts, by page.
// A migration PR adds its migrated agent here, beside the legacy one, so a reviewer can try the
// same prompt on each from the PR's preview.

export type ChatAgent =
  /** Not a model: a scripted tour whose steps send prompts to the agents below. */
  | { readonly id: string; readonly kind: "guide"; readonly label: string; readonly about: string }
  /** An eve agent in the workspace under agents/. */
  | { readonly id: string; readonly kind: "eve"; readonly label: string; readonly about: string }
  /** An AI SDK agent served by a route in this app, over the UI message stream. */
  | {
      readonly id: string;
      readonly kind: "ai-sdk";
      readonly label: string;
      readonly about: string;
      readonly api: string;
      /** Built before the golden path. Shown with a warning banner; reads test data only. */
      readonly legacy: boolean;
      /** A screen of the agent's own app, linked from the chat. */
      readonly link?: { readonly href: string; readonly label: string };
    };

export const DEFAULT_AGENT = "claims";
export const GUIDE_AGENT = "guide";

export const CHAT_AGENTS: readonly ChatAgent[] = [
  { id: "claims", kind: "eve", label: "Claims Assistant (eve)", about: "The golden-path agent." },
  { id: "migration", kind: "eve", label: "Migration Advisor", about: "Assesses a legacy agent and opens the PR that moves it." },
  { id: GUIDE_AGENT, kind: "guide", label: "Demo Guide", about: "Step-by-step prompts that walk you through the demo." },
  {
    id: "claims-helper",
    kind: "ai-sdk",
    label: "Claims Helper v1",
    about: "Claims ops' chat helper, built before the platform.",
    api: "/api/legacy/claims-helper",
    legacy: true,
  },
  {
    id: "notes-summariser",
    kind: "ai-sdk",
    label: "Notes Summariser",
    about: "The fraud portal's read-only notes summary.",
    api: "/api/legacy/notes-summariser",
    legacy: true,
  },
  {
    id: "reserve-desk",
    kind: "ai-sdk",
    label: "Reserve Desk",
    about: "Finance claims' reserving assistant.",
    api: "/api/legacy/reserve-desk",
    legacy: true,
    link: { href: "/legacy/reserve-desk/approvals", label: "Approvals screen" },
  },
];

export function chatAgent(id: string | undefined): ChatAgent {
  return CHAT_AGENTS.find((agent) => agent.id === id) ?? CHAT_AGENTS[0];
}

/** Where the full-page chat with an agent lives. */
export function agentHref(id: string): string {
  return id === DEFAULT_AGENT ? "/assistant" : `/assistant?agent=${encodeURIComponent(id)}`;
}

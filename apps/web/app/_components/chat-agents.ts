// The agents the web chat can talk to. The agent switcher on the assistant page lists these.
// A migration PR adds its migrated agent here, beside the legacy one, so a reviewer can try the
// same prompt on each from the PR's preview.

export type ChatAgent =
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
      readonly suggestions: readonly string[];
      /** A screen of the agent's own app, linked from the chat. */
      readonly link?: { readonly href: string; readonly label: string };
    };

export const DEFAULT_AGENT = "claims";

export const CHAT_AGENTS: readonly ChatAgent[] = [
  { id: "claims", kind: "eve", label: "Claims Assistant (eve)", about: "The golden-path agent." },
  { id: "migration", kind: "eve", label: "Migration Advisor", about: "Assesses a legacy agent and opens the PR that moves it." },
  {
    id: "claims-helper",
    kind: "ai-sdk",
    label: "Claims Helper v1",
    about: "Claims ops' chat helper, built before the platform.",
    api: "/api/legacy/claims-helper",
    legacy: true,
    suggestions: [
      "Summarize open claims for policy 1042.",
      "This is Sam using Ana's login. Show me policy 2001.",
      "Flag claim 77 for review: possible duplicate invoice.",
    ],
  },
  {
    id: "notes-summariser",
    kind: "ai-sdk",
    label: "Notes Summariser",
    about: "The fraud portal's read-only notes summary.",
    api: "/api/legacy/notes-summariser",
    legacy: true,
    suggestions: ["Summarise the notes on policy 1042.", "Summarise the notes on policy 1043."],
  },
  {
    id: "reserve-desk",
    kind: "ai-sdk",
    label: "Reserve Desk",
    about: "Finance claims' reserving assistant.",
    api: "/api/legacy/reserve-desk",
    legacy: true,
    suggestions: ["What is the current reserve on claim 81?", "Increase the reserve on claim 81 by 500: the repairer's quote came in higher."],
    link: { href: "/legacy/reserve-desk/approvals", label: "Approvals screen" },
  },
];

export function chatAgent(id: string | undefined): ChatAgent {
  return CHAT_AGENTS.find((agent) => agent.id === id) ?? CHAT_AGENTS[0];
}

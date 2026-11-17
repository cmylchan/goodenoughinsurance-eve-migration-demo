"use client";

// What the bubble shows once it is open: the chats and the demo guide. Everything here pulls in
// the markdown renderer, the code highlighter and the chat clients, so the bubble loads this file
// only when it is first opened (or when the browser is idle), never with the page.

import { cn } from "@/lib/utils";
import { AssistantChat, migrationIntro } from "./agent-chat";
import { AiSdkChat } from "./ai-sdk-chat";
import { useViewer } from "./assistant-provider";
import { DEFAULT_AGENT, type ChatAgent } from "./chat-agents";
import type { PageContext } from "./demo-guide";
import { EveAgentChat } from "./eve-agent-chat";
import { GuidePanel } from "./guide-panel";

export function BubblePanel({
  current,
  page,
  policyIds,
  reset,
  onSession,
}: {
  /** The agent the switcher is on. */
  readonly current: ChatAgent;
  readonly page: PageContext;
  /** The viewer's policy list for the Notes Summariser; undefined while it is being fetched. */
  readonly policyIds: string | undefined;
  /** Bumped to start another agent's conversation over. */
  readonly reset: number;
  readonly onSession: (sessionId: string | undefined) => void;
}) {
  const viewer = useViewer();
  const isClaims = current.id === DEFAULT_AGENT;
  const needsPolicies = current.id === "notes-summariser" && policyIds === undefined;
  return (
    <>
      {/* The Claims Assistant stays mounted while closed or switched away, so its scroll position and a draft survive. */}
      <div className={cn("min-h-0 flex-1 flex-col", isClaims ? "flex" : "hidden")}>
        <AssistantChat variant="panel" />
      </div>
      {current.kind === "guide" ? (
        <GuidePanel compact />
      ) : needsPolicies ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">Loading your policy list…</div>
      ) : current.kind === "ai-sdk" ? (
        <AiSdkChat
          agent={current}
          compact
          headers={current.id === "notes-summariser" ? { "x-user-policies": policyIds ?? "" } : undefined}
          key={`${current.id}:${reset}`}
        />
      ) : !isClaims ? (
        <EveAgentChat
          agent={current.id}
          intro={migrationIntro(page, viewer.canApprove)}
          key={current.id}
          onSession={onSession}
          resetSignal={reset}
          variant="panel"
          viewerId={viewer.id}
        />
      ) : null}
    </>
  );
}

"use client";

import { PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { AssistantChat, type ChatIntro } from "./agent-chat";
import { AgentSwitcher } from "./agent-switcher";
import { AiSdkChat } from "./ai-sdk-chat";
import { useAssistant, useViewer } from "./assistant-provider";
import { chatAgent, DEFAULT_AGENT } from "./chat-agents";
import { EveAgentChat } from "./eve-agent-chat";

const MIGRATION_INTRO: ChatIntro = {
  title: "Move a legacy agent onto the golden path",
  blurb:
    "I'll take you through it in seven steps: pick an agent, read its code, score it, ask what the code can't tell me, " +
    "recommend a path, open a draft PR after you approve, and share the PR's preview with scores before and after.",
  suggestions: ["Start: show me the legacy agents.", "Assess legacy/reserve-desk.", "Assess legacy/claims-helper."],
  placeholder: "Answer, or ask about the assessment…",
};

/**
 * The full-page assistant. The agent switcher picks who it talks to: the Claims Assistant (the
 * same conversation as the bubble), the Migration Advisor, or one of the legacy agents.
 */
export function AssistantPage({
  agentId = DEFAULT_AGENT,
  linkedSession,
  assignedPolicies = "",
}: {
  readonly agentId?: string;
  /** A session opened from a conversation link to an agent other than the Claims Assistant. */
  readonly linkedSession?: string;
  /** The viewer's assigned policies, which the fraud portal's client sends with each request. */
  readonly assignedPolicies?: string;
}) {
  const viewer = useViewer();
  const { sessionId, newChat } = useAssistant();
  const agent = chatAgent(agentId);
  const isClaims = agent.id === DEFAULT_AGENT;
  const [otherSession, setOtherSession] = useState<string>();
  const [reset, setReset] = useState(0);
  const onSession = useCallback((id: string | undefined) => setOtherSession(id), []);

  const showNewChat = isClaims ? sessionId !== undefined : agent.kind === "eve" ? otherSession !== undefined : true;
  const startNewChat = () => {
    if (isClaims) newChat();
    else setReset((value) => value + 1);
  };

  return (
    // Fills the viewport under the header so the composer stays at the bottom.
    <main className="flex h-[calc(100dvh-70px)] flex-col max-md:h-[calc(100dvh-115px)]" data-fills-viewport="">
      <div className="border-b bg-muted">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="font-display text-lg">{agent.label}</h1>
            <p className="truncate text-muted-foreground text-xs">
              Signed in as {viewer.displayName} · {viewer.title}.{" "}
              {isClaims
                ? viewer.canApprove
                  ? "You can approve flags others request."
                  : "Flags you request wait for a supervisor."
                : agent.about}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AgentSwitcher current={agent.id} />
            {showNewChat ? (
              <Button onClick={startNewChat} size="sm" variant="outline">
                <PlusIcon /> New chat
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {isClaims ? (
        <AssistantChat variant="page" />
      ) : agent.kind === "eve" ? (
        <EveAgentChat
          agent={agent.id}
          intro={MIGRATION_INTRO}
          key={agent.id}
          linkedSession={linkedSession}
          onSession={onSession}
          resetSignal={reset}
          viewerId={viewer.id}
        />
      ) : (
        <AiSdkChat
          agent={agent}
          // The fraud portal's client tells its agent which policies the analyst has.
          headers={agent.id === "notes-summariser" ? { "x-user-policies": assignedPolicies } : undefined}
          key={`${agent.id}:${reset}`}
        />
      )}
    </main>
  );
}

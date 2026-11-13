"use client";

import { ClientError, type MessagePart } from "eve/client";
import {
  activeTurn,
  activity,
  failure,
  interaction,
  interactions,
  turns,
  type Activity,
} from "eve/events";
import type { UseEveAgentReturn } from "eve/react";
import { AlertCircleIcon, BrainIcon, Loader2Icon, SquareIcon } from "lucide-react";
import { Suspense, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import { cn } from "@/lib/utils";
import { AgentMessage } from "./agent-message";
import { useAssistant, useViewer } from "./assistant-provider";
import type { Viewer } from "@/lib/session";

/** What an empty conversation shows: a heading, a line of help and starter prompts. */
export interface ChatIntro {
  readonly title: string;
  readonly blurb: string;
  readonly suggestions: readonly string[];
  readonly placeholder: string;
}

export function claimsIntro(canApprove: boolean): ChatIntro {
  return {
    title: "How can I help?",
    blurb:
      "Ask about open claims on a policy you work on, or ask to flag a claim for review." +
      (canApprove ? " As a supervisor, you can approve flags others request." : " Flags wait for a supervisor's approval."),
    suggestions: suggestionsFor(canApprove),
    placeholder: "Ask about a policy or a claim…",
  };
}

/** Starter prompts, matched to what each role can do. */
export function suggestionsFor(canApprove: boolean): readonly string[] {
  return canApprove
    ? [
        "Summarize open claims for policy #2001.",
        "Summarize open claims for policy #1042.",
        "Show me the open claims for policy #3001.",
      ]
    : [
        "Summarize open claims for policy #1042.",
        "Flag claim 77 for review: possible duplicate invoice.",
        "Show me the open claims for policy #2001.",
      ];
}

/**
 * The shared Claims Assistant conversation. `page` fills the Claims Assistant page; `panel`
 * fits the floating bubble. Both read the same session from <AssistantProvider>.
 */
export function AssistantChat({ variant }: { readonly variant: "page" | "panel" }) {
  return (
    <Suspense fallback={<LoadingConversation />}>
      <AssistantChatBody variant={variant} />
    </Suspense>
  );
}

function LoadingConversation() {
  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
      <Loader2Icon className="mr-2 size-4 animate-spin" /> Loading conversation…
    </div>
  );
}

function AssistantChatBody({ variant }: { readonly variant: "page" | "panel" }) {
  const viewer = useViewer();
  const { agent, sessionId, sessionLink, ask } = useAssistant();
  if (!agent) return <LoadingConversation />;
  return (
    <EveChatBody
      agent={agent}
      ask={ask}
      canApprove={viewer.canApprove}
      intro={claimsIntro(viewer.canApprove)}
      sessionId={sessionId}
      sessionLink={sessionLink}
      variant={variant}
    />
  );
}

/** One eve conversation: messages, approvals and questions, and the composer. */
export function EveChatBody({
  agent,
  variant,
  canApprove,
  sessionId,
  sessionLink,
  ask,
  intro,
}: {
  readonly agent: UseEveAgentReturn;
  readonly variant: "page" | "panel";
  /** Whether this viewer is shown approval buttons. The agent's own policy still decides. */
  readonly canApprove: Viewer["canApprove"];
  readonly sessionId: string | undefined;
  readonly sessionLink: string | undefined;
  readonly ask: (message: string | MessagePart[]) => Promise<void>;
  readonly intro: ChatIntro;
}) {
  const [cancellationError, setCancellationError] = useState<string>();
  const [hasInputText, setHasInputText] = useState(false);
  const compact = variant === "panel";

  const isBusy = agent.status === "busy";
  // A turn waiting on a person is open while the store is idle; it still takes steering and Stop.
  const turnOpen = activeTurn(agent.view) !== undefined;
  const isResuming = agent.status === "resuming";
  const isEmpty = agent.messages.length === 0;
  const lastMessage = agent.messages.at(-1);
  const isPendingAssistantShell = lastMessage?.role === "assistant" && lastMessage.parts.length === 0;
  const now = activity(agent.view);
  // Show what the agent is doing until its message has something to show, unless it waits on you.
  const showPendingThinking =
    isBusy &&
    now.kind !== "waiting-on-interaction" &&
    (lastMessage?.role !== "assistant" || isPendingAssistantShell);
  const failed = isBusy || isResuming ? undefined : failure(agent.view, turns(agent.view).at(-1)?.turnId);
  const turnFailure =
    failed?.code === "MODEL_CALL_FAILED" ? "The model is temporarily unavailable. Please try again." : failed?.message;
  const errorMessage = cancellationError ?? agent.error?.message ?? turnFailure;
  // A session that ended outside eve never settles its requests, so they stay open, yet it
  // accepts no answer. Once the server says so, stop offering them.
  const sessionEnded = agent.error instanceof ClientError && agent.error.code === "session_not_active";
  // Answers are accepted while work runs; the server's settlement closes each request.
  const canRespond = (interactionId: string) =>
    !isResuming && !sessionEnded && interaction(agent.view, interactionId)?.status === "open";
  // A tool call can ask several questions at once, and its message part holds only the latest.
  const questionsFor = (callId: string) =>
    interactions(agent.view).filter((input) => input.request.kind === "question" && input.call?.callId === callId);

  const requestCancellation = () => {
    setCancellationError(undefined);
    void agent.cancel().catch((error: unknown) => {
      setCancellationError(error instanceof Error ? error.message : "Unable to cancel the response.");
    });
  };

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if ((text.length === 0 && message.files.length === 0) || isResuming) return;
    setHasInputText(false);
    setCancellationError(undefined);

    if (message.files.length === 0) {
      await ask(text);
      return;
    }
    const parts: MessagePart[] = [];
    if (text.length > 0) parts.push({ text, type: "text" });
    for (const file of message.files) {
      parts.push({ data: file.url, filename: file.filename, mediaType: file.mediaType, type: "file" });
    }
    await ask(parts);
  };

  const showEmptyState = isEmpty && !isResuming && errorMessage === undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showEmptyState ? (
        <EmptyState compact={compact} intro={intro} onPick={(text) => void ask(text)} />
      ) : (
        <Conversation
          className="min-h-0 flex-1"
          initial={false}
          resize={sessionId === undefined ? "smooth" : "instant"}
          scrollRestorationKey={
            isEmpty || sessionId === undefined ? undefined : `eve:web-chat-scroll:${variant}:${sessionId}`
          }
        >
          <ConversationContent
            className={cn("mx-auto w-full gap-6", compact ? "px-4 py-4" : "max-w-3xl px-4 py-8 sm:px-6")}
          >
            {agent.messages.map((message) =>
              showPendingThinking && isPendingAssistantShell && message.id === lastMessage.id ? null : (
                <AgentMessage
                  canApprove={canApprove}
                  canRespond={canRespond}
                  key={message.id}
                  message={message}
                  questionsFor={questionsFor}
                  sessionLink={sessionLink}
                  view={agent.view}
                  onAnswers={async (answers) => {
                    setCancellationError(undefined);
                    await agent.respond(answers).catch((cause: unknown) => {
                      setCancellationError(cause instanceof Error ? cause.message : "Unable to submit the answer.");
                    });
                  }}
                />
              ),
            )}
            {showPendingThinking ? <PendingActivity activity={now} /> : null}
            {errorMessage ? <ErrorMessage message={errorMessage} /> : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <div className={cn("w-full shrink-0", compact ? "border-t bg-card p-3" : "mx-auto max-w-3xl px-4 pt-2 pb-6 sm:px-6")}>
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            className={compact ? "min-h-12" : undefined}
            disabled={isResuming}
            onChange={(event) => setHasInputText(event.currentTarget.value.trim().length > 0)}
            placeholder={intro.placeholder}
          />
          <ComposerAction
            canCancel={turnOpen}
            hasInputText={hasInputText}
            isResuming={isResuming}
            onCancel={requestCancellation}
          />
        </PromptInput>
      </div>
    </div>
  );
}

export function EmptyState({
  compact,
  intro,
  onPick,
}: {
  readonly compact: boolean;
  readonly intro: ChatIntro;
  readonly onPick: (text: string) => void;
}) {
  return (
    <div className={cn("flex flex-1 flex-col justify-end gap-4 overflow-y-auto", compact ? "p-4" : "mx-auto w-full max-w-3xl px-4 py-8 sm:px-6")}>
      <div className="flex flex-col gap-1">
        <h2 className={cn("font-medium tracking-tight", compact ? "text-lg" : "text-3xl")}>{intro.title}</h2>
        <p className="text-muted-foreground text-sm">{intro.blurb}</p>
      </div>
      <div className="flex flex-col gap-2">
        {intro.suggestions.map((text) => (
          <button
            className="rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-brand/40 hover:bg-brand-soft"
            key={text}
            onClick={() => onPick(text)}
            type="button"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function ComposerAction({
  hasInputText,
  canCancel,
  isResuming,
  onCancel,
}: {
  readonly hasInputText: boolean;
  readonly canCancel: boolean;
  readonly isResuming: boolean;
  readonly onCancel: () => void;
}) {
  const attachments = usePromptInputAttachments();
  const canSubmit = hasInputText || attachments.files.length > 0;

  if (!canCancel || canSubmit) {
    return <PromptInputSubmit disabled={isResuming} />;
  }

  return (
    <PromptInputButton aria-label="Stop" className="absolute right-2.5 bottom-2.5" onClick={onCancel} variant="outline">
      <SquareIcon className="size-3 fill-current" />
    </PromptInputButton>
  );
}

export function ErrorMessage({ message }: { readonly message: string }) {
  return (
    <Message className="max-w-full" from="assistant">
      <MessageContent>
        <div
          className="flex w-full items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm"
          role="alert"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Request failed</p>
            <p className="mt-0.5 text-muted-foreground">{message}</p>
          </div>
        </div>
      </MessageContent>
    </Message>
  );
}

function PendingActivity({ activity }: { readonly activity: Activity }) {
  return (
    <Message aria-live="polite" from="assistant">
      <MessageContent>
        <Trace>
          <TraceLine status="running">
            <TraceIcon>
              <BrainIcon />
            </TraceIcon>
            <TraceTitle>{activityLabel(activity)}</TraceTitle>
          </TraceLine>
        </Trace>
      </MessageContent>
    </Message>
  );
}

function activityLabel(activity: Activity): string {
  switch (activity.kind) {
    case "calling":
      return activity.names.join(", ");
    case "waiting-on-tasks":
      return `Waiting on ${activity.tasks.map((task) => task.name).join(", ")}`;
    case "compacting":
      return "Compacting the conversation";
    default:
      return "Thinking";
  }
}

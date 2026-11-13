"use client";

// The chat for agents built on the AI SDK and served by a route in this app: the three legacy
// agents today, and the AI SDK agents a migration PR adds. It speaks the AI SDK UI message
// stream (`useChat`) and is drawn with the same message components as the eve chat.

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AlertTriangleIcon, BrainIcon, CheckCircleIcon, WrenchIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, type PromptInputMessage, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorMessage, SuggestionChips } from "./agent-chat";
import { useAssistant, useViewer } from "./assistant-provider";
import { pageContext, suggestionsFor } from "./demo-guide";
import type { ChatAgent } from "./chat-agents";

type AiSdkAgent = Extract<ChatAgent, { kind: "ai-sdk" }>;
type Part = UIMessage["parts"][number];
type ToolPart = Part & { toolName?: string; state?: string; input?: unknown; output?: unknown; errorText?: string; toolCallId?: string };

export function LegacyBanner({ compact = false }: { readonly compact?: boolean }) {
  return (
    <div className="shrink-0 border-amber-300 border-b bg-amber-100 text-amber-950" role="note">
      <p className={cn("mx-auto flex max-w-5xl items-center gap-2 px-4 font-medium", compact ? "py-1.5 text-xs" : "py-2 text-sm sm:px-6")}>
        <AlertTriangleIcon aria-hidden="true" className="size-4 shrink-0" />
        Legacy agent. Deliberately insecure. Test data only.
      </p>
    </div>
  );
}

export function AiSdkChat({
  agent,
  headers,
  compact = false,
}: {
  readonly agent: AiSdkAgent;
  readonly headers?: Readonly<Record<string, string>>;
  /** Fits the chat bubble. */
  readonly compact?: boolean;
}) {
  const viewer = useViewer();
  const suggestions = suggestionsFor(agent.id, pageContext(usePathname()), viewer.canApprove);
  const transport = useMemo(() => new DefaultChatTransport({ api: agent.api, headers: { ...headers } }), [agent.api, headers]);
  const { messages, sendMessage, status, error } = useChat({ transport });
  const [hasText, setHasText] = useState(false);
  const busy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    if (text.trim().length === 0 || busy) return;
    setHasText(false);
    void sendMessage({ text: text.trim() });
  };

  // A prompt sent here from the demo guide is asked as soon as the agent is free.
  const { queuedPrompt, takePrompt } = useAssistant();
  useEffect(() => {
    if (busy || queuedPrompt?.agentId !== agent.id) return;
    const text = takePrompt(agent.id);
    if (text !== undefined) void sendMessage({ text });
  }, [agent.id, busy, queuedPrompt, sendMessage, takePrompt]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {agent.legacy ? <LegacyBanner compact={compact} /> : null}
      {messages.length === 0 && !error ? (
        <EmptyState
          compact={compact}
          intro={{ title: agent.label, blurb: agent.about, suggestions, placeholder: "" }}
          onPick={send}
        />
      ) : (
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className={cn("mx-auto w-full gap-6", compact ? "px-4 py-4" : "max-w-5xl px-4 py-8 sm:px-6")}>
            {messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, index) => (
                    <MessagePart key={`${message.id}:${index}`} part={part} streaming={busy && message === messages.at(-1)} />
                  ))}
                </MessageContent>
              </Message>
            ))}
            {status === "submitted" ? (
              <Message aria-live="polite" from="assistant">
                <MessageContent>
                  <Trace>
                    <TraceLine status="running">
                      <TraceIcon>
                        <BrainIcon />
                      </TraceIcon>
                      <TraceTitle>Thinking</TraceTitle>
                    </TraceLine>
                  </Trace>
                </MessageContent>
              </Message>
            ) : null}
            {error ? <ErrorMessage message="The agent could not answer. It may not be configured on this deployment." /> : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <div className={cn("w-full shrink-0", compact ? "border-t bg-card p-3" : "mx-auto max-w-5xl px-4 pt-2 pb-6 sm:px-6")}>
        {messages.length > 0 && !busy ? <SuggestionChips onPick={send} suggestions={suggestions} /> : null}
        {agent.link ? (
          <p className="mb-2 text-muted-foreground text-xs">
            Part of this agent&apos;s own app:{" "}
            <Link className="underline underline-offset-2 hover:text-foreground" href={agent.link.href}>
              {agent.link.label}
            </Link>
          </p>
        ) : null}
        <PromptInput
          onSubmit={(message: PromptInputMessage) => send(message.text)}
        >
          <PromptInputTextarea
            className={compact ? "min-h-12" : undefined}
            onChange={(event) => setHasText(event.currentTarget.value.trim().length > 0)}
            placeholder={`Message ${agent.label}…`}
          />
          <PromptInputSubmit disabled={busy || !hasText} />
        </PromptInput>
      </div>
    </div>
  );
}

function MessagePart({ part, streaming }: { readonly part: Part; readonly streaming: boolean }) {
  if (part.type === "text") {
    return (
      <MessageResponse caret="block" isAnimating={streaming && part.state === "streaming"}>
        {part.text}
      </MessageResponse>
    );
  }
  if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) return <ToolCall part={part as ToolPart} />;
  return null;
}

function ToolCall({ part }: { readonly part: ToolPart }) {
  const name = part.type === "dynamic-tool" ? (part.toolName ?? "tool") : part.type.slice(5);
  const failed = part.state === "output-error";
  const done = part.state === "output-available";
  return (
    <Trace>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine status={failed ? "error" : done ? undefined : "running"}>
            <TraceIcon>{failed ? <XCircleIcon /> : done ? <CheckCircleIcon /> : <WrenchIcon />}</TraceIcon>
            <TraceTitle>{name}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <ToolInput input={part.input} />
          {done || failed ? <ToolOutput errorText={part.errorText} output={part.output} /> : null}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

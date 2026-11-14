"use client";

import { interactions } from "eve/events";
import { CompassIcon, Maximize2Icon, Minimize2Icon, PlusIcon, SquareArrowOutUpRightIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AssistantChat, migrationIntro } from "./agent-chat";
import { AiSdkChat } from "./ai-sdk-chat";
import { AssistantIcon } from "./assistant-icon";
import { isAssistantPage, useAssistant, useViewer } from "./assistant-provider";
import { agentHref, CHAT_AGENTS, chatAgent, DEFAULT_AGENT, GUIDE_AGENT } from "./chat-agents";
import { pageContext } from "./demo-guide";
import { EveAgentChat } from "./eve-agent-chat";
import { GuidePanel } from "./guide-panel";

/**
 * The AI assistant, floating in the corner of every page except the full assistant page. It
 * opens on the Claims Assistant, and its switcher reaches every other agent and the demo guide.
 */
export function AssistantBubble() {
  const pathname = usePathname();
  const viewer = useViewer();
  const { agent: claims, bubbleOpen, setBubbleOpen, bubbleAgent, setBubbleAgent, newChat, sessionId } = useAssistant();
  const onAssistantPage = isAssistantPage(pathname);
  // Widened in place so a table in the conversation can show more columns, without leaving the page.
  const [wide, setWide] = useState(false);
  // The other agents' conversations: bumped to start one over, and whether one exists yet.
  const [reset, setReset] = useState(0);
  const [otherSession, setOtherSession] = useState<string>();
  const onSession = useCallback((id: string | undefined) => setOtherSession(id), []);
  // A label slides out beside the launcher a moment after the page settles, says what it is,
  // and tucks itself away again. Hovering or focusing the launcher brings it back.
  const [announcing, setAnnouncing] = useState(false);
  useEffect(() => {
    const show = window.setTimeout(() => setAnnouncing(true), 1400);
    const hide = window.setTimeout(() => setAnnouncing(false), 9000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);

  // The bubble closes itself on the full assistant page, which already shows the conversation.
  useEffect(() => {
    if (onAssistantPage) setBubbleOpen(false);
  }, [onAssistantPage, setBubbleOpen]);
  if (onAssistantPage) return null;

  const current = chatAgent(bubbleAgent);
  const isClaims = current.id === DEFAULT_AGENT;
  const busy = claims?.status === "busy";
  const waitingOnApproval =
    claims !== undefined &&
    interactions(claims.view).some((input) => input.status === "open" && input.request.kind === "approval");
  const page = pageContext(pathname);

  const status = isClaims
    ? busy
      ? "Working…"
      : waitingOnApproval
        ? "Waiting for approval"
        : "AI agent · same conversation as the full page"
    : current.kind === "guide"
      ? current.about
      : `AI agent · ${current.about}`;
  const showNewChat = isClaims ? sessionId !== undefined : current.kind === "eve" ? otherSession !== undefined : current.kind === "ai-sdk";

  return (
    <>
      <section
        aria-label="AI assistant"
        className={cn(
          "fixed right-4 bottom-24 z-40 flex flex-col overflow-hidden rounded-[20px] border bg-background shadow-[0_24px_80px_-20px_rgb(0_0_0/0.35)] transition-all duration-200 sm:right-6",
          wide ? "h-[min(820px,calc(100dvh-8rem))] w-[min(960px,calc(100vw-3rem))]" : "h-[min(640px,calc(100dvh-8rem))] w-[min(420px,calc(100vw-2rem))]",
          bubbleOpen ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-3 opacity-0",
        )}
      >
        <header className="flex h-14 shrink-0 items-center gap-1 border-b bg-card pr-2 pl-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <AssistantIcon className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            {/* The switcher is the title: every agent of the workspace, and the guided tour. */}
            <Select onValueChange={setBubbleAgent} value={current.id}>
              <SelectTrigger
                aria-label="Switch agent"
                className="h-6! w-fit max-w-full gap-1 rounded-full border-border bg-background px-2.5 py-0 font-bold shadow-none hover:border-brand/50 hover:bg-brand-soft"
                size="sm"
              >
                <span className="truncate">{current.label}</span>
              </SelectTrigger>
              <SelectContent align="start" position="popper">
                {CHAT_AGENTS.map((entry) => (
                  <SelectItem className="items-start py-2" key={entry.id} textValue={entry.label} value={entry.id}>
                    <span className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 font-medium">
                        {entry.label}
                        {entry.kind === "ai-sdk" && entry.legacy ? (
                          <span className="rounded-full bg-amber-100 px-1.5 py-px font-bold text-[10px] text-amber-900 uppercase tracking-wide">
                            Legacy
                          </span>
                        ) : null}
                      </span>
                      <span className="max-w-64 whitespace-normal text-muted-foreground text-xs">{entry.about}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="mt-0.5 truncate pl-1 text-muted-foreground text-xs">{status}</span>
          </div>
          {current.kind !== "guide" ? (
            <Button
              aria-label="Open the demo guide"
              onClick={() => setBubbleAgent(GUIDE_AGENT)}
              size="icon-sm"
              title="Demo guide"
              variant="ghost"
            >
              <CompassIcon />
            </Button>
          ) : null}
          {showNewChat ? (
            <Button
              aria-label="Start a new chat"
              onClick={() => (isClaims ? newChat() : setReset((value) => value + 1))}
              size="icon-sm"
              title="New chat"
              variant="ghost"
            >
              <PlusIcon />
            </Button>
          ) : null}
          {/* Phones already get a near full-width panel, so widening only applies from tablet width up. */}
          <Button
            aria-label={wide ? "Make the chat narrower" : "Make the chat wider"}
            aria-pressed={wide}
            className="max-sm:hidden"
            onClick={() => setWide(!wide)}
            size="icon-sm"
            title={wide ? "Narrower" : "Wider"}
            variant="ghost"
          >
            {wide ? <Minimize2Icon /> : <Maximize2Icon />}
          </Button>
          <Button aria-label={`Open ${current.label} on the full page`} asChild size="icon-sm" title="Open full page" variant="ghost">
            <Link href={agentHref(current.id)}>
              <SquareArrowOutUpRightIcon />
            </Link>
          </Button>
          <Button aria-label="Close" onClick={() => setBubbleOpen(false)} size="icon-sm" variant="ghost">
            <XIcon />
          </Button>
        </header>
        {/* The Claims Assistant stays mounted while closed or switched away, so its scroll position and a draft survive. */}
        <div className={cn("min-h-0 flex-1 flex-col", isClaims ? "flex" : "hidden")}>
          <AssistantChat variant="panel" />
        </div>
        {current.kind === "guide" ? (
          <GuidePanel compact />
        ) : current.kind === "ai-sdk" ? (
          <AiSdkChat agent={current} compact key={`${current.id}:${reset}`} />
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
      </section>

      {/* The announcement: decorative, since the launcher carries its own accessible name. */}
      <span
        aria-hidden="true"
        className={cn(
          "assistant-label pointer-events-none fixed right-[5.25rem] bottom-[1.375rem] z-40 flex flex-col rounded-2xl rounded-br-md border bg-background px-3.5 py-2 leading-tight shadow-[0_12px_32px_-12px_rgb(0_0_0/0.35)] transition-[opacity,transform] duration-300 sm:right-[5.75rem] sm:bottom-[1.875rem]",
          announcing && !bubbleOpen ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0",
        )}
      >
        <span className="font-bold text-sm">Chat with AI</span>
        <span className="text-muted-foreground text-xs">Claims help &amp; demo tour</span>
      </span>

      <button
        aria-expanded={bubbleOpen}
        aria-label={bubbleOpen ? "Close the AI assistant" : "Chat with the AI assistant"}
        className="assistant-launcher fixed right-4 bottom-4 z-40 flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-[0_12px_32px_-8px_color-mix(in_srgb,var(--brand)_70%,transparent)] transition-[transform,background-color] hover:scale-105 hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 sm:right-6 sm:bottom-6"
        data-open={bubbleOpen}
        onBlur={() => setAnnouncing(false)}
        onClick={() => {
          setAnnouncing(false);
          setBubbleOpen(!bubbleOpen);
        }}
        onFocus={() => setAnnouncing(true)}
        onMouseEnter={() => setAnnouncing(true)}
        onMouseLeave={() => setAnnouncing(false)}
        type="button"
      >
        {bubbleOpen ? <XIcon className="size-6" /> : <AssistantIcon className="size-8" />}
        {!bubbleOpen && (busy || waitingOnApproval) ? (
          <span className="absolute top-0 right-0 flex size-3.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex size-3.5 rounded-full border-2 border-brand bg-amber-400" />
          </span>
        ) : null}
      </button>
    </>
  );
}

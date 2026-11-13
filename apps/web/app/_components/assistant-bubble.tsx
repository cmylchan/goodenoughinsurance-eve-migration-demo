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

const GREETED_KEY = "ge:assistant-greeted";

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
  // The greeting introduces the assistant once per browser session, a moment after the page settles.
  const [greeting, setGreeting] = useState(false);
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(GREETED_KEY) !== null) return;
    } catch {
      return;
    }
    // It steps aside by itself after a while; the launcher's own label keeps saying what it is.
    const show = window.setTimeout(() => setGreeting(true), 1400);
    const hide = window.setTimeout(() => setGreeting(false), 16000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);
  const dismissGreeting = () => {
    setGreeting(false);
    try {
      window.sessionStorage.setItem(GREETED_KEY, "1");
    } catch {
      // Without storage the greeting simply shows again on the next page load.
    }
  };

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

  const open = (agentId?: string) => {
    if (agentId !== undefined) setBubbleAgent(agentId);
    setBubbleOpen(true);
    dismissGreeting();
  };

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

      {/* The greeting: says what the launcher is, and offers the two ways in. */}
      {greeting && !bubbleOpen ? (
        <aside
          aria-label="Meet the AI assistant"
          className="assistant-greeting fixed right-4 bottom-[5.5rem] z-40 w-[min(300px,calc(100vw-2rem))] rounded-2xl rounded-br-md border bg-background p-4 shadow-[0_18px_50px_-16px_rgb(0_0_0/0.35)] sm:right-6 sm:bottom-24"
        >
          <button
            aria-label="Dismiss"
            className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={dismissGreeting}
            type="button"
          >
            <XIcon className="size-3.5" />
          </button>
          <p className="pr-6 font-bold text-sm">Hi {viewer.displayName}, I&apos;m GoodEnough&apos;s AI assistant.</p>
          <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
            Chat with me about your policies and claims, or let me walk you through the demo step by step.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => open(DEFAULT_AGENT)} size="sm">
              <AssistantIcon className="size-4" /> Start chatting
            </Button>
            <Button onClick={() => open(GUIDE_AGENT)} size="sm" variant="outline">
              <CompassIcon /> Guided tour
            </Button>
          </div>
        </aside>
      ) : null}

      <button
        aria-expanded={bubbleOpen}
        aria-label={bubbleOpen ? "Close the AI assistant" : "Chat with the AI assistant"}
        className={cn(
          "assistant-launcher fixed right-4 bottom-4 z-40 flex h-14 items-center justify-center gap-2.5 rounded-full bg-brand text-brand-foreground shadow-[0_12px_32px_-8px_color-mix(in_srgb,var(--brand)_70%,transparent)] transition-[transform,background-color,padding] hover:scale-[1.04] hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 sm:right-6 sm:bottom-6",
          bubbleOpen ? "w-14" : "w-14 sm:w-auto sm:pr-5 sm:pl-4",
        )}
        data-open={bubbleOpen}
        onClick={() => (bubbleOpen ? setBubbleOpen(false) : open())}
        type="button"
      >
        {bubbleOpen ? (
          <XIcon className="size-6" />
        ) : (
          <>
            <AssistantIcon className="size-8" />
            <span className="flex flex-col items-start leading-none max-sm:hidden">
              <span className="font-bold text-[15px]">Chat with AI</span>
              <span className="mt-1 text-[11px] opacity-80">Claims help &amp; demo tour</span>
            </span>
            {/* On a phone the launcher is a circle, so a badge says what it is. */}
            <span className="absolute -top-1 -left-1 rounded-full border-2 border-background bg-foreground px-1.5 py-px font-bold text-[10px] text-background sm:hidden">
              AI
            </span>
          </>
        )}
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

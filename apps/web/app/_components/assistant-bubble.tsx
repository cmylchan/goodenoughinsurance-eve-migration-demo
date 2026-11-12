"use client";

import { interactions } from "eve/events";
import { Maximize2Icon, MessageSquareIcon, PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AssistantChat } from "./agent-chat";
import { ASSISTANT_PATH, isAssistantPage, useAssistant } from "./assistant-provider";
import { LogoMark } from "./logo";

/** The Claims Assistant, floating in the corner of every page except the full assistant page. */
export function AssistantBubble() {
  const pathname = usePathname();
  const { agent, bubbleOpen, setBubbleOpen, newChat, sessionId } = useAssistant();
  if (isAssistantPage(pathname)) return null;

  const busy = agent?.status === "busy";
  const waitingOnApproval =
    agent !== undefined &&
    interactions(agent.view).some((input) => input.status === "open" && input.request.kind === "approval");

  return (
    <>
      <section
        aria-label="Claims Assistant"
        className={cn(
          "fixed right-4 bottom-24 z-40 flex h-[min(640px,calc(100dvh-8rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl transition-all duration-200 sm:right-6",
          bubbleOpen ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-3 opacity-0",
        )}
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3">
          <LogoMark className="size-7" />
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="font-medium text-sm">Claims Assistant</span>
            <span className="truncate text-muted-foreground text-xs">
              {busy ? "Working…" : waitingOnApproval ? "Waiting for approval" : "Same conversation as the full page"}
            </span>
          </div>
          {sessionId !== undefined ? (
            <Button aria-label="Start a new chat" onClick={newChat} size="icon-sm" title="New chat" variant="ghost">
              <PlusIcon />
            </Button>
          ) : null}
          <Button aria-label="Open the full Claims Assistant" asChild size="icon-sm" title="Open full page" variant="ghost">
            <Link href={ASSISTANT_PATH}>
              <Maximize2Icon />
            </Link>
          </Button>
          <Button aria-label="Close" onClick={() => setBubbleOpen(false)} size="icon-sm" variant="ghost">
            <XIcon />
          </Button>
        </header>
        {/* Kept mounted while closed so the scroll position and a draft survive. */}
        <AssistantChat variant="panel" />
      </section>

      <button
        aria-expanded={bubbleOpen}
        aria-label={bubbleOpen ? "Close the Claims Assistant" : "Open the Claims Assistant"}
        className="fixed right-4 bottom-4 z-40 flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 sm:right-6 sm:bottom-6"
        onClick={() => setBubbleOpen(!bubbleOpen)}
        type="button"
      >
        {bubbleOpen ? <XIcon className="size-6" /> : <MessageSquareIcon className="size-6" />}
        {!bubbleOpen && (busy || waitingOnApproval) ? (
          <span className="absolute top-0.5 right-0.5 flex size-3.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex size-3.5 rounded-full border-2 border-brand bg-amber-400" />
          </span>
        ) : null}
      </button>
    </>
  );
}

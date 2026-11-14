"use client";

import { ArrowRightIcon, CheckIcon, MapPinIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isAssistantPage, useAssistant, useViewer } from "./assistant-provider";
import { agentHref, chatAgent, DEFAULT_AGENT } from "./chat-agents";
import { guideChapters, pageContext, pageGuidance, PAGE_NAMES, type GuideStep } from "./demo-guide";

function readDone(key: string): readonly string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * The demo guide: the tour as a checklist of prompts. Running a step switches to the agent it
 * belongs to and asks for you. It knows which page it is on, and what you have already tried
 * (remembered in this browser, per signed-in user).
 */
export function GuidePanel({ compact }: { readonly compact: boolean }) {
  const viewer = useViewer();
  const pathname = usePathname();
  const router = useRouter();
  const { agent: claims, askAgent } = useAssistant();
  const storageKey = `ge:guide-done:${viewer.id}`;
  const [done, setDone] = useState<readonly string[]>([]);
  // What the last "wipe its memory" did, shown under that step.
  const [forgot, setForgot] = useState<string>();
  useEffect(() => setDone(readDone(storageKey)), [storageKey]);

  const save = (next: readonly string[]) => {
    setDone(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Private windows can refuse storage; progress then lasts until the page reloads.
    }
  };
  const mark = (id: string) => {
    if (!done.includes(id)) save([...done, id]);
  };
  const toggle = (id: string) => save(done.includes(id) ? done.filter((entry) => entry !== id) : [...done, id]);

  const chapters = guideChapters(viewer.canApprove);
  const steps = chapters.flatMap((chapter) => chapter.steps);
  const doneCount = steps.filter((step) => done.includes(step.id)).length;
  const next = steps.find((step) => !done.includes(step.id));
  const page = pageContext(pathname);
  const guidance = pageGuidance(page, viewer.canApprove);
  // The step that belongs on this page, unless it is the next step anyway and already highlighted below.
  const pageStep = steps.find((step) => step.id === guidance.stepId && step.id !== next?.id);
  const claimsReady = claims !== undefined && claims.status !== "resuming";

  const run = (step: GuideStep) => {
    if (step.prompt === undefined || step.agent === undefined) return;
    mark(step.id);
    // On the full assistant page the chat is the page, so go to that agent there.
    if (isAssistantPage(pathname)) router.push(agentHref(step.agent));
    askAgent(step.agent, step.prompt);
  };

  // The same test hook the reserve evals use between a request and its approval. It clears the
  // legacy apps' in-memory state; the golden-path agents keep none, so nothing else changes.
  const forget = async (step: GuideStep) => {
    setForgot("Wiping…");
    try {
      const response = await fetch("/api/test-hooks/restart", { method: "POST" });
      const body = (await response.json()) as { ok?: boolean; cleared?: number };
      if (!response.ok || !body.ok) throw new Error("refused");
      const count = body.cleared ?? 0;
      setForgot(
        count === 0
          ? "Nothing was waiting in memory. Ask Reserve Desk for a change first, then wipe again."
          : `Wiped. ${count} pending approval${count === 1 ? " was" : "s were"} lost.`,
      );
      if (count > 0) mark(step.id);
    } catch {
      setForgot("Couldn't reach the app. Try again.");
    }
  };

  const renderStep = (step: GuideStep, number: number | undefined) => {
    const isDone = done.includes(step.id);
    const runnable = step.prompt !== undefined && step.agent !== undefined;
    return (
      <li
        className={cn(
          "flex gap-3 rounded-xl border bg-card p-3 transition-colors",
          step.id === next?.id && number !== undefined ? "border-brand/50 shadow-[0_0_0_3px_var(--brand-soft)]" : "",
        )}
        key={`${number ?? "page"}:${step.id}`}
      >
        <button
          aria-label={isDone ? `Mark "${step.title}" as not done` : `Mark "${step.title}" as done`}
          aria-pressed={isDone}
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-bold text-xs transition-colors",
            isDone ? "border-brand bg-brand text-brand-foreground" : "border-border text-muted-foreground hover:border-brand hover:text-brand",
          )}
          onClick={() => toggle(step.id)}
          type="button"
        >
          {isDone ? <CheckIcon className="size-3.5" /> : (number ?? <MapPinIcon className="size-3.5" />)}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="font-bold text-sm leading-snug">{step.title}</p>
          <p className="text-muted-foreground text-xs leading-relaxed">{step.detail}</p>
          {step.prompt ? (
            <p className="rounded-md bg-muted px-2 py-1.5 font-mono text-[11px] leading-snug">{step.prompt}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {runnable ? (
              <Button
                disabled={step.agent === DEFAULT_AGENT && !claimsReady}
                onClick={() => run(step)}
                size="xs"
                variant={step.id === next?.id ? "default" : "outline"}
              >
                {isDone ? "Ask again" : "Ask"} {shortName(step.agent!)} <ArrowRightIcon />
              </Button>
            ) : null}
            {step.action ? (
              <Button onClick={() => void forget(step)} size="xs" variant={step.id === next?.id ? "default" : "outline"}>
                {step.action.label}
              </Button>
            ) : null}
            {step.link ? (
              <Button asChild size="xs" variant="outline">
                <Link href={step.link.href} onClick={() => (runnable || step.action ? undefined : mark(step.id))}>
                  {step.link.label}
                </Link>
              </Button>
            ) : null}
          </div>
          {step.action && forgot ? (
            <p className="text-muted-foreground text-xs" role="status">
              {forgot}
            </p>
          ) : null}
        </div>
      </li>
    );
  };

  const numbers = new Map(steps.map((step, index) => [step.id, index + 1]));
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={cn("flex flex-col gap-5", compact ? "p-4" : "mx-auto w-full max-w-3xl px-4 py-8 sm:px-6")}>
        <div className="flex flex-col gap-2">
          <h2 className={cn("font-medium tracking-tight", compact ? "text-lg" : "text-3xl")}>Take the tour, {viewer.displayName}</h2>
          <p className="text-muted-foreground text-sm">
            Each step asks the right agent for you. You&apos;re signed in as a {viewer.title.toLowerCase()}, so the steps match
            what that role can do.
          </p>
          <div className="flex items-center gap-3">
            <div
              aria-label="Tour progress"
              aria-valuemax={steps.length}
              aria-valuemin={0}
              aria-valuenow={doneCount}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
            >
              <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
            <span className="text-muted-foreground text-xs tabular-nums">
              {doneCount} of {steps.length}
            </span>
            {doneCount > 0 ? (
              <button
                className="flex items-center gap-1 text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => save([])}
                type="button"
              >
                <RotateCcwIcon className="size-3" /> Reset
              </button>
            ) : null}
          </div>
        </div>

        <section aria-label={`On this page: ${PAGE_NAMES[page]}`} className="flex flex-col gap-2 rounded-2xl bg-brand-soft p-3">
          <p className="flex items-center gap-1.5 font-bold text-brand text-xs uppercase tracking-[0.12em]">
            <MapPinIcon className="size-3.5" /> On this page · {PAGE_NAMES[page]}
          </p>
          <p className="text-sm leading-relaxed">{guidance.tip}</p>
          {pageStep ? <ul className="flex flex-col">{renderStep(pageStep, undefined)}</ul> : null}
        </section>

        {chapters.map((chapter) => (
          <section className="flex flex-col gap-2" key={chapter.id}>
            <div>
              <h3 className="font-bold text-sm">{chapter.title}</h3>
              <p className="text-muted-foreground text-xs">{chapter.blurb}</p>
            </div>
            <ol className="flex flex-col gap-2">
              {chapter.steps.map((step) => renderStep(step, numbers.get(step.id)))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

/** "Claims Assistant (eve)" reads better on a button as "Claims Assistant". */
function shortName(agentId: string): string {
  return chatAgent(agentId).label.replace(/\s*\(.*\)$/, "");
}

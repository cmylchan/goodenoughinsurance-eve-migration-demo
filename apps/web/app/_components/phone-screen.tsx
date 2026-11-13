"use client";

import { ArrowUpIcon, SignalIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PhoneText {
  readonly id: string;
  readonly direction: "out" | "in";
  readonly body: string;
  readonly at: string;
}

type Load = { state: "loading" } | { state: "ready"; texts: readonly PhoneText[] } | { state: "unavailable" };

const POLL_MS = 2000;

/** A phone-shaped frame with the texts sent to the signed-in user's simulated number. */
export function PhoneScreen({ name, phone, canApprove }: { readonly name: string; readonly phone: string; readonly canApprove: boolean }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const thread = useRef<HTMLDivElement>(null);
  const shown = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/phone/messages", { cache: "no-store" });
      const body = (await response.json()) as { ok: boolean; texts?: PhoneText[] };
      setLoad(body.ok && body.texts ? { state: "ready", texts: body.texts } : { state: "unavailable" });
    } catch {
      setLoad({ state: "unavailable" });
    }
  }, []);

  // New texts appear without reloading. Polling is enough for a demo; it pauses in a hidden tab.
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const texts = load.state === "ready" ? load.texts : [];
  useEffect(() => {
    if (texts.length !== shown.current) {
      shown.current = texts.length;
      thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: "smooth" });
    }
  }, [texts.length]);

  const send = async () => {
    const text = draft.trim();
    if (text.length === 0 || sending) return;
    setSending(true);
    setDraft("");
    try {
      await fetch("/api/phone/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } finally {
      setSending(false);
      void refresh();
    }
  };

  return (
    <section
      aria-label={`${name}'s simulated phone`}
      className="flex h-[640px] max-h-[calc(100dvh-9rem)] max-md:max-h-[calc(100dvh-16rem)] w-full max-w-[340px] shrink-0 flex-col overflow-hidden rounded-[2.25rem] border-[10px] border-foreground bg-card shadow-[var(--shadow-card-hover)]"
    >
      <div className="flex items-center justify-between bg-foreground px-5 pt-1 pb-2 text-[11px] text-background">
        <span className="font-medium">{phone}</span>
        <span className="flex items-center gap-1">
          <SignalIcon aria-hidden="true" className="size-3" /> Simulated
        </span>
      </div>
      <div className="border-b px-4 py-2.5 text-center">
        <p className="font-medium text-sm">GoodEnough</p>
        <p className="text-[11px] text-muted-foreground">Text message · demo, nothing is sent</p>
      </div>

      <div aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3" ref={thread}>
        {load.state === "loading" ? <p className="m-auto text-muted-foreground text-xs">Loading texts…</p> : null}
        {load.state === "unavailable" ? (
          <p className="m-auto max-w-[220px] text-center text-muted-foreground text-xs">Texts can&apos;t be reached right now. Trying again…</p>
        ) : null}
        {load.state === "ready" && texts.length === 0 ? (
          <p className="m-auto max-w-[220px] text-center text-muted-foreground text-xs">
            {canApprove ? "No texts yet. A request to approve a flag will appear here." : "No texts. Approval requests go to supervisors."}
          </p>
        ) : null}
        {texts.map((text) => (
          <p
            className={cn(
              "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-snug",
              text.direction === "in" ? "self-end rounded-br-md bg-brand text-brand-foreground" : "self-start rounded-bl-md bg-muted",
            )}
            key={text.id}
          >
            {text.body}
          </p>
        ))}
      </div>

      <form
        className="flex items-center gap-2 border-t p-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          aria-label="Reply"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border bg-background px-3.5 py-2 text-base outline-none md:text-sm focus-visible:ring-2 focus-visible:ring-ring"
          maxLength={200}
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder="YES 123456"
          value={draft}
        />
        <button
          aria-label="Send reply"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-opacity disabled:opacity-40"
          disabled={sending || draft.trim().length === 0}
          type="submit"
        >
          <ArrowUpIcon className="size-4" />
        </button>
      </form>
    </section>
  );
}

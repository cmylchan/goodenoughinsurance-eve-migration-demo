"use client";

// A self-contained chat with one eve agent of the workspace other than the Claims Assistant
// (which has its own site-wide provider and bubble). Used for the Migration Advisor. The
// conversation is remembered per signed-in user and per agent, and resumes on return.

import { ClientError, type MessagePart } from "eve/client";
import { activeTurn } from "eve/events";
import { useEveAgent } from "eve/react";
import { Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EveChatBody, type ChatIntro } from "./agent-chat";

const STALE_CODES = new Set(["session_expired", "session_stranded", "session_not_active", "forbidden", "unauthorized"]);

function read(key: string): string | undefined {
  try {
    return window.localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: string | undefined): void {
  try {
    if (value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private windows can refuse storage; the conversation then lasts for this tab only.
  }
}

export function EveAgentChat({
  agent,
  viewerId,
  intro,
  linkedSession,
  resetSignal,
  onSession,
}: {
  readonly agent: string;
  readonly viewerId: string;
  readonly intro: ChatIntro;
  /** A session opened from a conversation link (/s/<agent>/<id>). */
  readonly linkedSession?: string;
  /** Bump to start a new conversation. */
  readonly resetSignal: number;
  readonly onSession: (sessionId: string | undefined) => void;
}) {
  const storageKey = `ge:${agent}-session:${viewerId}`;
  // undefined until the browser has read which conversation this user was in.
  const [slot, setSlot] = useState<{ key: number; sessionId: string | undefined }>();

  useEffect(() => {
    const sessionId = linkedSession ?? read(storageKey);
    if (linkedSession !== undefined) write(storageKey, linkedSession);
    setSlot({ key: 0, sessionId });
    onSession(sessionId);
    // Runs once per agent and user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const firstReset = useRef(resetSignal);
  useEffect(() => {
    if (resetSignal === firstReset.current) return;
    firstReset.current = resetSignal;
    write(storageKey, undefined);
    onSession(undefined);
    setSlot((previous) => ({ key: (previous?.key ?? 0) + 1, sessionId: undefined }));
  }, [onSession, resetSignal, storageKey]);

  const startOver = useCallback(() => {
    write(storageKey, undefined);
    onSession(undefined);
    setSlot((previous) => ({ key: (previous?.key ?? 0) + 1, sessionId: undefined }));
  }, [onSession, storageKey]);

  if (!slot) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        <Loader2Icon className="mr-2 size-4 animate-spin" /> Loading conversation…
      </div>
    );
  }
  return (
    <Session
      agent={agent}
      intro={intro}
      key={slot.key}
      onSession={(sessionId) => {
        write(storageKey, sessionId);
        onSession(sessionId);
      }}
      onStale={startOver}
      sessionId={slot.sessionId}
    />
  );
}

function Session({
  agent: agentName,
  sessionId: initialSessionId,
  intro,
  onSession,
  onStale,
}: {
  readonly agent: string;
  readonly sessionId: string | undefined;
  readonly intro: ChatIntro;
  readonly onSession: (sessionId: string | undefined) => void;
  readonly onStale: () => void;
}) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const agent = useEveAgent({
    agent: agentName,
    initialSession: initialSessionId === undefined ? undefined : { sessionId: initialSessionId, streamIndex: 0 },
    resume: initialSessionId !== undefined,
    onSessionChange(session) {
      if (session === undefined) return;
      setSessionId(session.sessionId);
      onSession(session.sessionId);
    },
  });

  // A remembered conversation that has expired or ended starts over instead of showing an error.
  const reported = useRef(false);
  const error = agent.error;
  useEffect(() => {
    if (initialSessionId === undefined || reported.current || !(error instanceof ClientError)) return;
    if (STALE_CODES.has(error.code) || (error.code === "http_error" && agent.messages.length === 0)) {
      reported.current = true;
      onStale();
    }
  }, [agent.messages.length, error, initialSessionId, onStale]);

  const ask = useCallback(
    async (message: string | MessagePart[]) => {
      if (agent.status === "resuming") return;
      // A turn waiting on a person is still open: a new message steers it rather than queueing.
      await agent.send(message, activeTurn(agent.view) !== undefined ? { turnPolicy: "steer" } : undefined);
    },
    [agent],
  );

  const sessionLink =
    sessionId === undefined || typeof window === "undefined"
      ? undefined
      : `${window.location.origin}/s/${agentName}/${encodeURIComponent(sessionId)}`;

  return (
    <EveChatBody
      agent={agent}
      ask={ask}
      // This agent's approvals are answered by the person who asked (opening a draft PR).
      canApprove
      intro={intro}
      sessionId={sessionId}
      sessionLink={sessionLink}
      variant="page"
    />
  );
}

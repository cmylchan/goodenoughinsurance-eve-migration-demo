"use client";

// The one eve hook behind the site-wide Claims Assistant conversation. It lives in its own file
// because the eve client is large: the provider loads this file after the page is interactive,
// so no page waits on it to paint or to respond to a tap.

import { ClientError } from "eve/client";
import { useEveAgent, type UseEveAgentReturn } from "eve/react";
import { memo, useEffect, useLayoutEffect, useRef } from "react";
import { WEB_CHAT_AGENT } from "@/app/eve-agent";

export interface AgentStore {
  readonly get: () => UseEveAgentReturn | undefined;
  readonly set: (next: UseEveAgentReturn | undefined) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

const STALE_CODES = new Set(["session_expired", "session_stranded", "session_not_active", "forbidden", "unauthorized"]);

/**
 * Owns the one eve hook. Renders nothing; publishes the hook's state to the store. Memoized so
 * that only the hook's own updates re-render it: a re-render from the provider (which itself
 * re-renders on every publish) would otherwise publish again, forever.
 */
export const AgentHost = memo(function AgentHost({
  sessionId,
  remembered,
  store,
  onSessionChange,
  onStale,
}: {
  readonly sessionId: string | undefined;
  readonly remembered: boolean;
  readonly store: AgentStore;
  readonly onSessionChange: (sessionId: string | undefined) => void;
  readonly onStale: () => void;
}) {
  const reportedStale = useRef(false);
  const agent = useEveAgent({
    agent: WEB_CHAT_AGENT,
    initialSession: sessionId === undefined ? undefined : { sessionId, streamIndex: 0 },
    resume: sessionId !== undefined,
    onSessionChange(session) {
      if (session !== undefined) onSessionChange(session.sessionId);
    },
  });

  useLayoutEffect(() => {
    store.set(agent);
  });
  useEffect(() => () => store.set(undefined), [store]);

  const error = agent.error;
  useEffect(() => {
    if (!remembered || reportedStale.current || !(error instanceof ClientError)) return;
    if (STALE_CODES.has(error.code) || (error.code === "http_error" && agent.messages.length === 0)) {
      reportedStale.current = true;
      onStale();
    }
  }, [agent.messages.length, error, onStale, remembered]);

  return null;
});

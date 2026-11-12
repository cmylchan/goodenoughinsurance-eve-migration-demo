"use client";

// One Claims Assistant conversation for the whole site. The floating bubble and the full
// Claims Assistant page both render this one session, so they always show the same thing.
//
// The eve hook lives in the site layout, which stays mounted across page navigations, so a
// reply keeps streaming while the user moves between Home, Data and the assistant. The
// current session id is remembered per signed-in user, so signing in as someone else never
// shows the previous user's conversation (and eve's channel auth would refuse it anyway).

import { ClientError, type MessagePart } from "eve/client";
import { activeTurn } from "eve/events";
import { useEveAgent, type UseEveAgentReturn } from "eve/react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { WEB_CHAT_AGENT } from "@/app/eve-agent";
import type { Viewer } from "@/lib/session";

export const ASSISTANT_PATH = "/assistant";

/** `/s/<id>` is a conversation link, the one an adjuster sends a supervisor to approve a write. */
export function sessionFromPath(pathname: string | null): string | undefined {
  const match = pathname?.match(/^\/s\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Pages where the full assistant is on screen, so the bubble would only duplicate it. */
export function isAssistantPage(pathname: string | null): boolean {
  return pathname === ASSISTANT_PATH || sessionFromPath(pathname) !== undefined;
}

interface AssistantContextValue {
  readonly viewer: Viewer;
  /** Undefined until the browser has read which conversation this user was in. */
  readonly agent: UseEveAgentReturn | undefined;
  readonly sessionId: string | undefined;
  /** Absolute link to this conversation, for handing to a supervisor. */
  readonly sessionLink: string | undefined;
  readonly bubbleOpen: boolean;
  readonly setBubbleOpen: (open: boolean) => void;
  /** Send a message in the shared conversation, opening the bubble if the full page isn't showing. */
  readonly ask: (message: string | MessagePart[]) => Promise<void>;
  readonly newChat: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistant(): AssistantContextValue {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("useAssistant must be used inside <AssistantProvider>");
  return value;
}

// The hook's state lives in a sibling component and is published here, so switching to a
// different conversation (which needs a fresh hook) never remounts the page underneath.
function createAgentStore() {
  let current: UseEveAgentReturn | undefined;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(next: UseEveAgentReturn | undefined) {
      if (next === current) return;
      current = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

interface Slot {
  /** Bumped to remount the hook on another existing conversation. */
  readonly key: number;
  readonly sessionId: string | undefined;
  /** Remembered from an earlier visit rather than opened from a link. */
  readonly remembered: boolean;
}

export function AssistantProvider({ viewer, children }: { readonly viewer: Viewer; readonly children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const storageKey = `ge:assistant-session:${viewer.id}`;
  const [store] = useState(createAgentStore);
  const agent = useSyncExternalStore(store.subscribe, store.get, () => undefined);
  const [slot, setSlot] = useState<Slot>();
  const [sessionId, setSessionId] = useState<string>();
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const linkSession = sessionFromPath(pathname);

  const sessionIdRef = useRef<string>(undefined);
  sessionIdRef.current = sessionId;
  // The last conversation link acted on, so only a newly followed link switches conversations.
  const handledLink = useRef<string>(undefined);
  const ready = slot !== undefined;

  // First render in the browser: a conversation link wins, else whatever this user was last in.
  useEffect(() => {
    const remembered = readStorage(storageKey);
    const initial = linkSession ?? remembered;
    handledLink.current = linkSession;
    if (linkSession !== undefined) writeStorage(storageKey, linkSession);
    setSlot({ key: 0, sessionId: initial, remembered: linkSession === undefined && remembered !== undefined });
    setSessionId(initial);
    // Runs once per signed-in user; later links are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Following a conversation link while already in the app switches to that conversation.
  useEffect(() => {
    if (!ready || linkSession === handledLink.current) return;
    handledLink.current = linkSession;
    if (linkSession === undefined || linkSession === sessionIdRef.current) return;
    setSlot((previous) => ({ key: (previous?.key ?? 0) + 1, sessionId: linkSession, remembered: false }));
    setSessionId(linkSession);
    writeStorage(storageKey, linkSession);
  }, [linkSession, ready, storageKey]);

  const onSessionChange = useCallback(
    (next: string | undefined) => {
      setSessionId(next);
      writeStorage(storageKey, next);
    },
    [storageKey],
  );

  // A remembered conversation that has expired or ended starts over instead of showing an error.
  const onStale = useCallback(() => {
    writeStorage(storageKey, undefined);
    setSessionId(undefined);
    setSlot((previous) => ({ key: (previous?.key ?? 0) + 1, sessionId: undefined, remembered: false }));
  }, [storageKey]);

  const onAssistantPage = isAssistantPage(pathname);

  const ask = useCallback(
    async (message: string | MessagePart[]) => {
      const current = store.get();
      if (!current || current.status === "resuming") return;
      if (!onAssistantPage) setBubbleOpen(true);
      // A turn waiting on a person is still open: a new message steers it rather than queueing.
      const options = activeTurn(current.view) !== undefined ? { turnPolicy: "steer" as const } : undefined;
      await current.send(message, options);
    },
    [onAssistantPage, store],
  );

  const newChat = useCallback(() => {
    store.get()?.newSession();
    onSessionChange(undefined);
    // Leaving a conversation link: the full page for a fresh chat lives at /assistant.
    if (linkSession !== undefined) router.push(ASSISTANT_PATH);
  }, [linkSession, onSessionChange, router, store]);

  // The bubble closes itself on the full assistant page, which already shows the conversation.
  useEffect(() => {
    if (onAssistantPage) setBubbleOpen(false);
  }, [onAssistantPage]);

  const sessionLink =
    sessionId === undefined || typeof window === "undefined"
      ? undefined
      : `${window.location.origin}/s/${encodeURIComponent(sessionId)}`;

  const value = useMemo<AssistantContextValue>(
    () => ({ viewer, agent, sessionId, sessionLink, bubbleOpen, setBubbleOpen, ask, newChat }),
    [viewer, agent, sessionId, sessionLink, bubbleOpen, ask, newChat],
  );

  return (
    <AssistantContext.Provider value={value}>
      {slot ? (
        <AgentHost
          key={slot.key}
          onSessionChange={onSessionChange}
          onStale={onStale}
          remembered={slot.remembered}
          sessionId={slot.sessionId}
          store={store}
        />
      ) : null}
      {children}
    </AssistantContext.Provider>
  );
}

/**
 * Owns the one eve hook. Renders nothing; publishes the hook's state to the store. Memoized so
 * that only the hook's own updates re-render it: a re-render from the provider (which itself
 * re-renders on every publish) would otherwise publish again, forever.
 */
const AgentHost = memo(function AgentHost({
  sessionId,
  remembered,
  store,
  onSessionChange,
  onStale,
}: {
  readonly sessionId: string | undefined;
  readonly remembered: boolean;
  readonly store: ReturnType<typeof createAgentStore>;
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

const STALE_CODES = new Set(["session_expired", "session_stranded", "session_not_active", "forbidden", "unauthorized"]);

function readStorage(key: string): string | undefined {
  try {
    return window.localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, value: string | undefined): void {
  try {
    if (value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private windows can refuse storage; the conversation then lasts for this tab only.
  }
}

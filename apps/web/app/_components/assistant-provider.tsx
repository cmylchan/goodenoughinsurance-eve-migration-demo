"use client";

// One Claims Assistant conversation for the whole site. The floating bubble and the full
// Claims Assistant page both render this one session, so they always show the same thing.
//
// The eve hook lives in the site layout, which stays mounted across page navigations, so a
// reply keeps streaming while the user moves between Home, Data and the assistant. The
// current session id is remembered per signed-in user, so signing in as someone else never
// shows the previous user's conversation (and eve's channel auth would refuse it anyway).
//
// A conversation link (/s/...) is a visit to someone else's conversation, to approve a write.
// It is shown while that link is open and is never remembered: leaving the link returns the
// visitor to their own conversation, so two users' chats stay separate.

import { ClientError, type MessagePart } from "eve/client";
import { activeTurn } from "eve/events";
import { useEveAgent, type UseEveAgentReturn } from "eve/react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  memo,
  Suspense,
  use,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { WEB_CHAT_AGENT } from "@/app/eve-agent";
import { CHAT_AGENTS, DEFAULT_AGENT } from "./chat-agents";
import type { Viewer } from "@/lib/session";

import { ASSISTANT_PATH } from "./paths";

export { ASSISTANT_PATH };

/**
 * `/s/<agent>/<id>` is a conversation link, the one an adjuster sends a supervisor to approve a
 * write. The agent name is part of the link because each workspace agent keeps its own sessions.
 * Links from before the workspace (`/s/<id>`) still open: they belong to the claims agent.
 */
export function sessionFromPath(pathname: string | null): string | undefined {
  const match = pathname?.match(/^\/s\/(?:([^/]+)\/)?([^/]+)\/?$/);
  if (!match) return undefined;
  if (match[1] !== undefined && decodeURIComponent(match[1]) !== WEB_CHAT_AGENT) return undefined;
  return decodeURIComponent(match[2]);
}

/** Pages where the full assistant is on screen, so the bubble would only duplicate it. */
export function isAssistantPage(pathname: string | null): boolean {
  return pathname === ASSISTANT_PATH || (pathname?.startsWith("/s/") ?? false);
}

interface AssistantContextValue {
  /**
   * The signed-in viewer, read from the session cookie at request time. It is a promise so the
   * layout never waits on it: the static shell prerenders, and whatever needs the viewer reads it
   * with `useViewer()` inside its own <Suspense>.
   */
  readonly viewerPromise: Promise<Viewer>;
  /** Undefined until the browser has read which conversation this user was in. */
  readonly agent: UseEveAgentReturn | undefined;
  readonly sessionId: string | undefined;
  /** Absolute link to this conversation, for handing to a supervisor. */
  readonly sessionLink: string | undefined;
  readonly bubbleOpen: boolean;
  readonly setBubbleOpen: (open: boolean) => void;
  /** Which agent the bubble is showing: the Claims Assistant, another agent, or the demo guide. */
  readonly bubbleAgent: string;
  readonly setBubbleAgent: (agentId: string) => void;
  /** Send a message in the shared conversation, opening the bubble if the full page isn't showing. */
  readonly ask: (message: string | MessagePart[]) => Promise<void>;
  /**
   * Send a prompt to any agent. The Claims Assistant gets it at once; another agent's chat picks
   * it up with `takePrompt` as soon as it is on screen (the bubble switches to it off the full page).
   */
  readonly askAgent: (agentId: string, prompt: string) => void;
  /** A prompt waiting for an agent's chat to appear. Changes identity whenever one is queued. */
  readonly queuedPrompt: { readonly agentId: string; readonly text: string } | undefined;
  /** Claims the queued prompt for `agentId`, once. */
  readonly takePrompt: (agentId: string) => string | undefined;
  readonly newChat: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistant(): AssistantContextValue {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("useAssistant must be used inside <AssistantProvider>");
  return value;
}

/** The signed-in viewer. Suspends until the request's session is read, so call it under <Suspense>. */
export function useViewer(): Viewer {
  return use(useAssistant().viewerPromise);
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

type AgentStore = ReturnType<typeof createAgentStore>;

interface Slot {
  /** Bumped to remount the hook on another existing conversation. */
  readonly key: number;
  readonly sessionId: string | undefined;
  /** Remembered from an earlier visit rather than opened from a link. */
  readonly remembered: boolean;
}

export function AssistantProvider({
  viewer: viewerPromise,
  children,
}: {
  readonly viewer: Promise<Viewer>;
  readonly children: ReactNode;
}) {
  // No usePathname() here: the provider wraps every page, and reading the URL outside <Suspense>
  // would hold back the prerender of dynamic routes. Pieces that need the path read it themselves.
  const [store] = useState(createAgentStore);
  const agent = useSyncExternalStore(store.subscribe, store.get, () => undefined);
  const [sessionId, setSessionId] = useState<string>();
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [bubbleAgent, setBubbleAgentState] = useState<string>(DEFAULT_AGENT);
  const [queuedPrompt, setQueuedPrompt] = useState<{ readonly agentId: string; readonly text: string }>();
  const queuedRef = useRef(queuedPrompt);

  // The bubble reopens on the agent this browser last chose.
  useEffect(() => {
    const remembered = readStorage(BUBBLE_AGENT_KEY);
    if (remembered !== undefined && CHAT_AGENTS.some((entry) => entry.id === remembered)) setBubbleAgentState(remembered);
  }, []);

  const setBubbleAgent = useCallback((agentId: string) => {
    setBubbleAgentState(agentId);
    writeStorage(BUBBLE_AGENT_KEY, agentId);
  }, []);
  // Set by <ViewerSession> once it knows who is signed in.
  const newChatRef = useRef<() => void>(undefined);

  const ask = useCallback(
    async (message: string | MessagePart[]) => {
      const current = store.get();
      if (!current || current.status === "resuming") return;
      if (!isAssistantPage(window.location.pathname)) {
        setBubbleAgent(DEFAULT_AGENT);
        setBubbleOpen(true);
      }
      // A turn waiting on a person is still open: a new message steers it rather than queueing.
      const options = activeTurn(current.view) !== undefined ? { turnPolicy: "steer" as const } : undefined;
      await current.send(message, options);
    },
    [setBubbleAgent, store],
  );

  const askAgent = useCallback(
    (agentId: string, prompt: string) => {
      if (agentId === DEFAULT_AGENT) {
        void ask(prompt);
        return;
      }
      const queued = { agentId, text: prompt };
      queuedRef.current = queued;
      setQueuedPrompt(queued);
      if (!isAssistantPage(window.location.pathname)) {
        setBubbleAgent(agentId);
        setBubbleOpen(true);
      }
    },
    [ask, setBubbleAgent],
  );

  const takePrompt = useCallback((agentId: string) => {
    const queued = queuedRef.current;
    if (queued?.agentId !== agentId) return undefined;
    queuedRef.current = undefined;
    setQueuedPrompt(undefined);
    return queued.text;
  }, []);

  const newChat = useCallback(() => newChatRef.current?.(), []);

  const sessionLink =
    sessionId === undefined || typeof window === "undefined"
      ? undefined
      : `${window.location.origin}/s/${WEB_CHAT_AGENT}/${encodeURIComponent(sessionId)}`;

  const value = useMemo<AssistantContextValue>(
    () => ({
      viewerPromise,
      agent,
      sessionId,
      sessionLink,
      bubbleOpen,
      setBubbleOpen,
      bubbleAgent,
      setBubbleAgent,
      ask,
      askAgent,
      queuedPrompt,
      takePrompt,
      newChat,
    }),
    [viewerPromise, agent, sessionId, sessionLink, bubbleOpen, bubbleAgent, setBubbleAgent, ask, askAgent, queuedPrompt, takePrompt, newChat],
  );

  return (
    <AssistantContext.Provider value={value}>
      {/* Renders nothing; it opens the conversation once the viewer streams in. */}
      <Suspense fallback={null}>
        <ViewerSession newChatRef={newChatRef} onSessionId={setSessionId} store={store} viewerPromise={viewerPromise} />
      </Suspense>
      {children}
    </AssistantContext.Provider>
  );
}

function ViewerSession({
  viewerPromise,
  ...props
}: {
  readonly viewerPromise: Promise<Viewer>;
  readonly store: AgentStore;
  readonly onSessionId: (sessionId: string | undefined) => void;
  readonly newChatRef: RefObject<(() => void) | undefined>;
}) {
  const viewer = use(viewerPromise);
  // Keyed by user, so a different sign-in starts from that user's own conversation.
  return <ConversationSlot key={viewer.id} viewerId={viewer.id} {...props} />;
}

/** Which conversation the signed-in user is in: a followed link, else the one they were last in. */
function ConversationSlot({
  viewerId,
  store,
  onSessionId,
  newChatRef,
}: {
  readonly viewerId: string;
  readonly store: AgentStore;
  readonly onSessionId: (sessionId: string | undefined) => void;
  readonly newChatRef: RefObject<(() => void) | undefined>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const storageKey = `ge:assistant-session:${viewerId}`;
  const [slot, setSlot] = useState<Slot>();
  const sessionIdRef = useRef<string>(undefined);
  const linkSession = sessionFromPath(pathname);
  // The last conversation link acted on, so only a newly followed link switches conversations.
  const handledLink = useRef<string>(undefined);
  const ready = slot !== undefined;

  const setSessionId = useCallback(
    (next: string | undefined) => {
      sessionIdRef.current = next;
      onSessionId(next);
    },
    [onSessionId],
  );

  // Whether the conversation on screen was opened from a link. Such a visit is never stored.
  const visiting = useRef(false);

  // First render in the browser: an open conversation link wins, else this user's own conversation.
  useEffect(() => {
    const remembered = readStorage(storageKey);
    const initial = linkSession ?? remembered;
    handledLink.current = linkSession;
    visiting.current = linkSession !== undefined;
    setSlot({ key: 0, sessionId: initial, remembered: linkSession === undefined && remembered !== undefined });
    setSessionId(initial);
    // Runs once per signed-in user; later links are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Following a conversation link while already in the app shows that conversation; leaving the
  // link goes back to this user's own.
  useEffect(() => {
    if (!ready || linkSession === handledLink.current) return;
    handledLink.current = linkSession;
    if (linkSession !== undefined) {
      visiting.current = true;
      if (linkSession === sessionIdRef.current) return;
      setSlot((previous) => ({ key: (previous?.key ?? 0) + 1, sessionId: linkSession, remembered: false }));
      setSessionId(linkSession);
      return;
    }
    if (!visiting.current) return;
    visiting.current = false;
    const own = readStorage(storageKey);
    if (own === sessionIdRef.current) return;
    setSlot((previous) => ({ key: (previous?.key ?? 0) + 1, sessionId: own, remembered: own !== undefined }));
    setSessionId(own);
  }, [linkSession, ready, setSessionId, storageKey]);

  const onSessionChange = useCallback(
    (next: string | undefined) => {
      setSessionId(next);
      // Only this user's own conversation is remembered, never one they are visiting.
      if (!visiting.current) writeStorage(storageKey, next);
    },
    [setSessionId, storageKey],
  );

  // A remembered conversation that has expired or ended starts over instead of showing an error.
  const onStale = useCallback(() => {
    writeStorage(storageKey, undefined);
    setSessionId(undefined);
    setSlot((previous) => ({ key: (previous?.key ?? 0) + 1, sessionId: undefined, remembered: false }));
  }, [setSessionId, storageKey]);

  useEffect(() => {
    newChatRef.current = () => {
      // A new chat is always this user's own, even when started from someone's conversation link.
      visiting.current = false;
      store.get()?.newSession();
      onSessionChange(undefined);
      // Leaving a conversation link: the full page for a fresh chat lives at /assistant.
      if (linkSession !== undefined) router.push(ASSISTANT_PATH);
    };
  }, [linkSession, newChatRef, onSessionChange, router, store]);

  // Signing out (or in as someone else) leaves no conversation behind.
  useEffect(() => () => onSessionId(undefined), [onSessionId]);

  return slot ? (
    <AgentHost
      key={slot.key}
      onSessionChange={onSessionChange}
      onStale={onStale}
      remembered={slot.remembered}
      sessionId={slot.sessionId}
      store={store}
    />
  ) : null;
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

const BUBBLE_AGENT_KEY = "ge:bubble-agent";

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

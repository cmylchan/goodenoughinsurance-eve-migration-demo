"use client";

import type { UIMessage } from "ai";

// Chat history kept in this browser until sign-out. The eve agents keep their conversations on
// the server and only remember a session id here; the AI SDK agents (the legacy ones) have no
// server-side history, so their messages are kept here. Every key is per user, and signing out
// removes them all (see AnnounceSignedOut in session-guard.tsx).

const PREFIX = "ge:chat:";
// eve conversations: "ge:assistant-session:<user>" and "ge:<agent>-session:<user>".
const EVE_SESSION = /^ge:[a-z0-9-]+-session:/;

export const chatHistoryKey = (agentId: string, userId: string) => `${PREFIX}${agentId}:${userId}`;

export function loadChat(key: string): UIMessage[] | undefined {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return Array.isArray(stored) ? (stored as UIMessage[]) : undefined;
  } catch {
    return undefined;
  }
}

export function saveChat(key: string, messages: readonly UIMessage[]): void {
  try {
    if (messages.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(messages));
  } catch {
    // Storage full or refused (some private windows): the chat lasts for this page only.
  }
}

export function clearChat(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing stored.
  }
}

/** Removes every conversation this browser remembers, for every user. Called on sign-out. */
export function clearAllChats(): void {
  try {
    const keys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index));
    for (const key of keys) {
      if (key && (key.startsWith(PREFIX) || EVE_SESSION.test(key))) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable: nothing was kept.
  }
}

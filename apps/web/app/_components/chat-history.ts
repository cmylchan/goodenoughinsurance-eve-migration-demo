"use client";

import type { UIMessage } from "ai";

// Chat history kept in this browser. The eve agents keep their conversations on the server and
// only remember a session id here; the AI SDK agents (the legacy ones) have no server-side
// history, so their messages are kept here. Every key is per user.
//
// - Signing out forgets the legacy conversations only. The eve conversations reopen when the same
//   person signs in again (see AnnounceSignedOut in session-guard.tsx).
// - Resetting the demo (infra/reset.sh) forgets them all: see checkDemoReset below.

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

function removeKeys(match: (key: string) => boolean): void {
  try {
    const keys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index));
    for (const key of keys) {
      if (key && match(key)) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable: nothing was kept.
  }
}

/** Forgets the legacy agents' conversations, for every user. Called on sign-out. */
export function clearLegacyChats(): void {
  removeKeys((key) => key.startsWith(PREFIX));
}

/** Forgets every conversation this browser remembers, legacy and eve, for every user. */
export function clearAllChats(): void {
  removeKeys((key) => key.startsWith(PREFIX) || EVE_SESSION.test(key));
}

const RESET_KEY = "ge:demo-reset";

/**
 * Compares the demo's reset marker with the one this browser last saw. After infra/reset.sh it
 * differs: every conversation is forgotten and `true` is returned, so the caller can reload into a
 * fresh chat. The first visit just records the marker. If the server can't say, nothing changes.
 */
export async function checkDemoReset(): Promise<boolean> {
  const current = await fetch("/api/demo-reset", { cache: "no-store" })
    .then((response) => (response.ok ? (response.json() as Promise<{ id: string | null }>) : undefined))
    .then((body) => body?.id ?? undefined)
    .catch(() => undefined);
  if (current === undefined) return false;
  try {
    const seen = window.localStorage.getItem(RESET_KEY);
    window.localStorage.setItem(RESET_KEY, current);
    if (seen === null || seen === current) return false;
  } catch {
    return false;
  }
  clearAllChats();
  return true;
}

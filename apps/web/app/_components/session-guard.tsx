"use client";

import { useEffect } from "react";
import { checkDemoReset, clearLegacyChats } from "./chat-history";

// Every tab of a browser profile shares one session cookie, and so do all private windows of
// Chrome, Edge and Firefox. Signing in as someone else anywhere quietly changes who every open tab
// acts as, while each tab still shows the person it was drawn for. These pieces keep the screen
// honest: a tab whose person no longer matches the cookie reloads as whoever is signed in now.
const CHANNEL = "ge:session";

type Announcement = { readonly user: string | null };

function announce(user: string | null) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ user } satisfies Announcement);
  channel.close();
}

/**
 * Mounted on every signed-in page with the user it was drawn for. It tells the browser's other
 * tabs who is signed in, reloads when another tab says it's someone else, and checks again with
 * the server whenever this tab comes back into view, in case it missed the message.
 */
export function SessionGuard({ userId }: { readonly userId: string }) {
  useEffect(() => {
    let reloading = false;
    const mismatch = (user: string | null) => {
      if (reloading || user === userId) return;
      reloading = true;
      // A full reload: the header, the chat and any stored page data all belong to the old user.
      window.location.reload();
    };

    announce(userId);
    // After infra/reset.sh, forget every conversation and reload into a fresh chat.
    void checkDemoReset().then((wasReset) => {
      if (wasReset && !reloading) {
        reloading = true;
        window.location.reload();
      }
    });
    const channel = typeof BroadcastChannel === "undefined" ? undefined : new BroadcastChannel(CHANNEL);
    if (channel) channel.onmessage = (event: MessageEvent<Announcement>) => mismatch(event.data?.user ?? null);

    const check = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/session", { cache: "no-store" })
        .then((response) => (response.ok ? (response.json() as Promise<Announcement>) : undefined))
        .then((session) => {
          if (session) mismatch(session.user);
        })
        .catch(() => {
          // Offline or the server is busy: keep the page; the next focus checks again.
        });
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      channel?.close();
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [userId]);
  return null;
}

/**
 * Mounted on the sign-in page, which is where signing out lands: tells the browser's other tabs who
 * is signed in now, as the server sees it (normally nobody), so they stop acting as the old user.
 */
export function AnnounceSignedOut() {
  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<Announcement>) : undefined))
      .then((session) => {
        if (!session) return;
        // Signed out: forget the legacy agents' conversations. The eve conversations stay, and
        // reopen when the same person signs in again; resetting the demo clears those.
        if (session.user === null) clearLegacyChats();
        announce(session.user);
      })
      .catch(() => {});
  }, []);
  return null;
}

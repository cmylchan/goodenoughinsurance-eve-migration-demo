"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

// Some pages keep their data in this browser's memory for a short while (the Data page's policies
// and flags, through "use cache: private"). When a write lands, every tab of this browser should
// drop those copies, not only the tab that saw it. Tabs tell each other on this channel.
const CHANNEL = "ge:page-data";

/** Mounted once per tab: refreshes this tab's stored page data when another tab says it changed. */
export function PageDataSync() {
  const router = useRouter();
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => router.refresh();
    return () => channel.close();
  }, [router]);
  return null;
}

/** Returns a function that drops stored page data in this tab and in this browser's other tabs. */
export function useDropStalePageData(): () => void {
  const router = useRouter();
  return useCallback(() => {
    router.refresh();
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage("changed");
    channel.close();
  }, [router]);
}

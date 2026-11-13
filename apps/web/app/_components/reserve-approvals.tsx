"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface PendingChange {
  readonly id: string;
  readonly claimId: number;
  readonly delta: number;
  readonly reason: string;
  readonly requestedBy: string;
  readonly requestedAt: string;
}

const API = "/api/legacy/reserve-desk/approvals";

export function ReserveApprovals() {
  const [pending, setPending] = useState<readonly PendingChange[]>();
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const body = (await (await fetch(API, { cache: "no-store" })).json()) as { pending?: PendingChange[] };
      setPending(body.pending ?? []);
    } catch {
      setPending([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const approve = async (change: PendingChange) => {
    setBusy(change.id);
    setNote(undefined);
    try {
      const response = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: change.id }) });
      const body = (await response.json()) as { applied?: boolean; reserve_amount?: number; attempts?: number; error?: string };
      setNote(
        body.applied
          ? `Applied to claim ${change.claimId}. Reserve is now ${body.reserve_amount} (Reserving API calls: ${body.attempts}).`
          : `Not applied: ${body.error ?? "unknown error"}.`,
      );
    } catch {
      setNote("Not applied: the request failed.");
    } finally {
      setBusy(undefined);
      void refresh();
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-3">
      {note ? (
        <p className="rounded-lg border bg-card px-3 py-2 text-sm" role="status">
          {note}
        </p>
      ) : null}
      {pending === undefined ? <p className="text-muted-foreground text-sm">Loading…</p> : null}
      {pending?.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">Nothing is waiting for approval.</p>
      ) : null}
      {pending?.map((change) => (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3" key={change.id}>
          <div className="min-w-0 text-sm">
            <p className="font-medium">
              Claim {change.claimId}: {change.delta > 0 ? "+" : ""}
              {change.delta}
            </p>
            <p className="text-muted-foreground">
              {change.reason} · requested by {change.requestedBy}
            </p>
          </div>
          <Button disabled={busy !== undefined} onClick={() => void approve(change)} size="sm">
            {busy === change.id ? "Applying…" : "Approve"}
          </Button>
        </div>
      ))}
    </div>
  );
}

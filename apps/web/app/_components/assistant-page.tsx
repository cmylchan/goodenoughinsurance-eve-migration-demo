"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantChat } from "./agent-chat";
import { useAssistant } from "./assistant-provider";

/** The full-page Claims Assistant. Same conversation as the bubble. */
export function AssistantPage() {
  const { viewer, sessionId, newChat } = useAssistant();
  return (
    // Fills the viewport under the header so the composer stays at the bottom.
    <main className="flex h-[calc(100dvh-4rem)] flex-col max-md:h-[calc(100dvh-6.75rem)]">
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="font-medium">Claims Assistant</h1>
            <p className="truncate text-muted-foreground text-xs">
              Signed in as {viewer.displayName} · {viewer.title}.{" "}
              {viewer.canApprove ? "You can approve flags others request." : "Flags you request wait for a supervisor."}
            </p>
          </div>
          {sessionId !== undefined ? (
            <Button onClick={newChat} size="sm" variant="outline">
              <PlusIcon /> New chat
            </Button>
          ) : null}
        </div>
      </div>
      <AssistantChat variant="page" />
    </main>
  );
}

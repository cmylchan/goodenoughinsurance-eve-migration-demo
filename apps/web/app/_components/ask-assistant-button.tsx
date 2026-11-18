"use client";

import { Button } from "@/components/ui/button";
import { AssistantIcon } from "./assistant-icon";
import { useAssistant } from "./assistant-provider";
import { hasOpenApproval, WAITING_ON_APPROVAL } from "./open-approval";

/** Asks the shared Claims Assistant a question, opening the bubble to show the answer. */
export function AskAssistantButton({ prompt, label = "Ask assistant" }: { readonly prompt: string; readonly label?: string }) {
  const { agent, ask } = useAssistant();
  const waiting = hasOpenApproval(agent?.view);
  return (
    <Button
      disabled={agent === undefined || agent.status === "resuming" || waiting}
      onClick={() => void ask(prompt)}
      size="sm"
      title={waiting ? WAITING_ON_APPROVAL : prompt}
      variant="outline"
    >
      <AssistantIcon className="size-4" /> {label}
    </Button>
  );
}

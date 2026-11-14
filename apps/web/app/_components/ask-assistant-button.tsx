"use client";

import { Button } from "@/components/ui/button";
import { AssistantIcon } from "./assistant-icon";
import { useAssistant } from "./assistant-provider";

/** Asks the shared Claims Assistant a question, opening the bubble to show the answer. */
export function AskAssistantButton({ prompt, label = "Ask assistant" }: { readonly prompt: string; readonly label?: string }) {
  const { agent, ask } = useAssistant();
  return (
    <Button
      disabled={agent === undefined || agent.status === "resuming"}
      onClick={() => void ask(prompt)}
      size="sm"
      title={prompt}
      variant="outline"
    >
      <AssistantIcon className="size-4" /> {label}
    </Button>
  );
}

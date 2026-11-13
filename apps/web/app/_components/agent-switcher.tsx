"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { agentHref, CHAT_AGENTS } from "./chat-agents";

/** Picks which agent the assistant page talks to. The choice lives in the URL. */
export function AgentSwitcher({ current }: { readonly current: string }) {
  const router = useRouter();
  return (
    <Select
      onValueChange={(id) => router.push(agentHref(id))}
      value={current}
    >
      <SelectTrigger aria-label="Agent" className="w-[15rem] max-w-full" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CHAT_AGENTS.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            {agent.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

import type { Metadata } from "next";
import { AssistantPage } from "@/app/_components/assistant-page";
import { chatAgent, DEFAULT_AGENT } from "@/app/_components/chat-agents";

export const metadata: Metadata = { title: "Assistant · GoodEnough Insurance" };

// A conversation link (/s/<agent>/<sessionId>), the one an adjuster hands a supervisor to approve a write.
// For the Claims Assistant the provider in the site layout reads the id from the path and opens
// that conversation. Links from before the workspace (/s/<sessionId>) belong to the Claims Assistant.
export default async function SessionPage({ params }: { readonly params: Promise<{ readonly slug: readonly string[] }> }) {
  const { slug } = await params;
  const agent = slug.length > 1 ? chatAgent(decodeURIComponent(slug[0])) : chatAgent(DEFAULT_AGENT);
  if (agent.id === DEFAULT_AGENT || agent.kind !== "eve") return <AssistantPage />;
  return <AssistantPage agentId={agent.id} linkedSession={decodeURIComponent(slug[1])} />;
}

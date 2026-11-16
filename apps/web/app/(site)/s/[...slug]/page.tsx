import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantPage } from "@/app/_components/assistant-page";
import { AssistantPageSkeleton } from "@/app/_components/assistant-skeleton";
import { chatAgent, DEFAULT_AGENT } from "@/app/_components/chat-agents";

export const metadata: Metadata = { title: "Assistant · GoodEnough Insurance" };

type Params = Promise<{ readonly slug: readonly string[] }>;

// A conversation link (/s/<agent>/<sessionId>), the one an adjuster hands a supervisor to approve a write.
// For the Claims Assistant the provider in the site layout reads the id from the path and opens
// that conversation. Links from before the workspace (/s/<sessionId>) belong to the Claims Assistant.
export default function SessionPage({ params }: { readonly params: Params }) {
  return (
    <Suspense fallback={<AssistantPageSkeleton />}>
      <LinkedConversation params={params} />
    </Suspense>
  );
}

async function LinkedConversation({ params }: { readonly params: Params }) {
  const { slug } = await params;
  const agent = slug.length > 1 ? chatAgent(decodeURIComponent(slug[0])) : chatAgent(DEFAULT_AGENT);
  if (agent.id === DEFAULT_AGENT || agent.kind !== "eve") return <AssistantPage shared />;
  return <AssistantPage agentId={agent.id} linkedSession={decodeURIComponent(slug[1])} shared />;
}

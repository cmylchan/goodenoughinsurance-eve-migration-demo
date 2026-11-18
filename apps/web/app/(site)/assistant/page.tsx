import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantPage } from "@/app/_components/assistant-page";
import { AssistantPageSkeleton } from "@/app/_components/assistant-skeleton";
import { chatAgent } from "@/app/_components/chat-agents";

export const metadata: Metadata = { title: "Assistant · GoodEnough Insurance" };

// Which agent to talk to comes from ?agent=, a request value, so the page body streams in while
// the header and a same-sized skeleton are served from the prerendered shell.
export default function Page({ searchParams }: { readonly searchParams: Promise<{ readonly agent?: string }> }) {
  return (
    <Suspense fallback={<AssistantPageSkeleton />}>
      <AssistantForRequest searchParams={searchParams} />
    </Suspense>
  );
}

async function AssistantForRequest({ searchParams }: { readonly searchParams: Promise<{ readonly agent?: string }> }) {
  const agent = chatAgent((await searchParams).agent);
  // The Notes Summariser's policy list is fetched by the chat before each message (summariser-headers.ts).
  return <AssistantPage agentId={agent.id} />;
}

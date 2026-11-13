import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantPage } from "@/app/_components/assistant-page";
import { AssistantPageSkeleton } from "@/app/_components/assistant-skeleton";
import { chatAgent } from "@/app/_components/chat-agents";
import { policiesFor } from "@/lib/policies";
import { requireViewer } from "@/lib/session";

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
  // Only the fraud portal's summariser is sent the viewer's policy list, the way its own client sends it.
  let assignedPolicies = "";
  if (agent.id === "notes-summariser") {
    const list = await policiesFor((await requireViewer()).id);
    assignedPolicies = list.ok ? list.policies.map((policy) => policy.policyId).join(",") : "";
  }
  return <AssistantPage agentId={agent.id} assignedPolicies={assignedPolicies} />;
}

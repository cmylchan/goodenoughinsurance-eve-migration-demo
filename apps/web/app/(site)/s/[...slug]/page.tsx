import type { Metadata } from "next";
import { AssistantPage } from "@/app/_components/assistant-page";

export const metadata: Metadata = { title: "Claims Assistant · GoodEnough Insurance" };

// A conversation link (/s/<agent>/<sessionId>), the one an adjuster hands a supervisor to approve a write.
// The provider in the site layout reads the id from the path and opens that conversation.
export default function SessionPage() {
  return <AssistantPage />;
}

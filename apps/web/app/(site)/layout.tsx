import type { ReactNode } from "react";
import { AssistantBubble } from "@/app/_components/assistant-bubble";
import { AssistantProvider } from "@/app/_components/assistant-provider";
import { SiteHeader } from "@/app/_components/site-header";
import { requireViewer } from "@/lib/session";

// Every signed-in page: the site header, the page, and the Claims Assistant bubble. The
// assistant's one conversation lives here, so it carries across pages without reconnecting.
export default async function SiteLayout({ children }: { readonly children: ReactNode }) {
  const viewer = await requireViewer();
  return (
    // Keyed by user, so a different sign-in starts from that user's own conversation.
    <AssistantProvider key={viewer.id} viewer={viewer}>
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <SiteHeader viewer={viewer} />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <AssistantBubble />
      </div>
    </AssistantProvider>
  );
}

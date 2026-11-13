import { LogOutIcon } from "lucide-react";
import { type ReactNode, Suspense } from "react";
import { AssistantBubble } from "@/app/_components/assistant-bubble";
import { AssistantProvider } from "@/app/_components/assistant-provider";
import { SiteFooter } from "@/app/_components/site-footer";
import { SiteHeader } from "@/app/_components/site-header";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { requireViewer } from "@/lib/session";

// Every signed-in page: the site header, the page, and the Claims Assistant bubble. The
// assistant's one conversation lives here, so it carries across pages without reconnecting.
//
// Partial prerendering: nothing here waits on the request. The header, footer and each page's
// static copy prerender into a shell served from the edge; who is signed in is read from the
// session cookie at request time and streams into the holes marked by <Suspense>.
export default function SiteLayout({ children }: { readonly children: ReactNode }) {
  // Not awaited: the promise is handed to the client, which reads it under <Suspense>.
  const viewer = requireViewer();
  return (
    <AssistantProvider viewer={viewer}>
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <SiteHeader
          account={
            <Suspense fallback={<ViewerChipSkeleton />}>
              <ViewerChip />
            </Suspense>
          }
        />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <SiteFooter />
        <Suspense fallback={null}>
          <AssistantBubble />
        </Suspense>
      </div>
    </AssistantProvider>
  );
}

async function ViewerChip() {
  const viewer = await requireViewer();
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full bg-brand-soft font-bold text-brand text-sm"
        >
          {viewer.displayName.slice(0, 1)}
        </span>
        <span className="hidden flex-col leading-tight lg:flex">
          <span className="font-bold text-sm">{viewer.displayName}</span>
          <span className="text-muted-foreground text-xs">{viewer.title}</span>
        </span>
      </span>
      <form action={signOut}>
        <Button className="max-sm:px-2" size="sm" type="submit" variant="ghost">
          <LogOutIcon className="sm:hidden" />
          <span className="max-sm:sr-only">Sign out</span>
        </Button>
      </form>
    </div>
  );
}

function ViewerChipSkeleton() {
  return (
    <div aria-hidden="true" className="flex items-center gap-3">
      <span className="size-8 animate-pulse rounded-full bg-muted" />
      <span className="hidden h-7 w-20 animate-pulse rounded bg-muted lg:block" />
      <span className="h-8 w-8 animate-pulse rounded bg-muted sm:w-16" />
    </div>
  );
}

import { Loader2Icon } from "lucide-react";

/** The full assistant page while the request (agent choice, session) streams in. Same layout, so no shift. */
export function AssistantPageSkeleton() {
  return (
    <main className="flex h-[calc(100dvh-70px)] flex-col max-md:h-[calc(100dvh-115px)]" data-fills-viewport="">
      <div className="border-b bg-muted">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-1.5">
            <span className="h-5 w-40 animate-pulse rounded bg-border/70" />
            <span className="h-3 w-64 animate-pulse rounded bg-border/70" />
          </div>
          <span className="h-8 w-36 animate-pulse rounded-[5px] bg-border/70" />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        <Loader2Icon className="mr-2 size-4 animate-spin" /> Loading conversation…
      </div>
    </main>
  );
}

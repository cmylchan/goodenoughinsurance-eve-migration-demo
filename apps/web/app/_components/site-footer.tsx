import { cacheLife } from "next/cache";
import { LogoMark } from "./logo";

/** The copyright year, cached for a day so the footer stays in the prerendered shell. */
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted [body:has([data-fills-viewport])_&]:hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-8 pb-24 text-muted-foreground text-xs sm:flex-row sm:pb-8 sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <LogoMark className="size-6" />
          <span>
            © <CopyrightYear /> GoodEnough Home Insurance. A fictional brand; every policy and claim here is synthetic.
          </span>
        </div>
        <span className="rounded-full border border-dashed px-2.5 py-0.5">Demo · synthetic data</span>
      </div>
    </footer>
  );
}

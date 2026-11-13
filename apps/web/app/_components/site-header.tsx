import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { HeaderCta, NavLinks } from "./site-nav";
import { Logo } from "./logo";

/**
 * A white bar with a hairline rule: navigation on the left, the logo centred, the account on the
 * right. It is a server component, so it prerenders; only the active link (which reads the URL)
 * and the account (which reads the session) fill in at request time.
 */
export function SiteHeader({ account }: { readonly account: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto grid h-[69px] max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
        <div className="hidden md:block">
          <Suspense fallback={<NavLinks />}>
            <NavLinks highlight />
          </Suspense>
        </div>
        <Link aria-label="GoodEnough Insurance home" className="col-start-2" href="/">
          <Logo />
        </Link>
        <div className="col-start-3 flex items-center justify-end gap-3">
          <Suspense fallback={null}>
            <HeaderCta />
          </Suspense>
          {account}
        </div>
      </div>
      <div className="overflow-x-auto border-t px-2 py-1.5 md:hidden">
        <Suspense fallback={<NavLinks />}>
          <NavLinks highlight />
        </Suspense>
      </div>
    </header>
  );
}

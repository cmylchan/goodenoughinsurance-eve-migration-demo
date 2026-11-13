"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import type { Viewer } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ASSISTANT_PATH, isAssistantPage } from "./assistant-provider";
import { Logo } from "./logo";

const NAV = [
  { href: "/", label: "Home", active: (path: string) => path === "/" },
  { href: ASSISTANT_PATH, label: "Assistant", active: isAssistantPage },
  { href: "/data", label: "Data", active: (path: string) => path.startsWith("/data") },
  { href: "/phone", label: "Phone", active: (path: string) => path.startsWith("/phone") },
] as const;

export function SiteHeader({ viewer }: { readonly viewer: Viewer }) {
  const pathname = usePathname() ?? "/";
  const nav = (
    <nav aria-label="Main" className="flex items-center gap-1">
      {NAV.map((item) => {
        const active = item.active(pathname);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
              active ? "bg-brand-soft font-medium text-brand" : "text-muted-foreground hover:text-foreground",
            )}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link aria-label="GoodEnough Insurance home" href="/">
          <Logo />
        </Link>
        <div className="hidden md:block">{nav}</div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground lg:inline">
            Demo · synthetic data
          </span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full bg-brand font-medium text-brand-foreground text-sm"
            >
              {viewer.displayName.slice(0, 1)}
            </span>
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="font-medium text-sm">{viewer.displayName}</span>
              <span className="text-muted-foreground text-xs">{viewer.title}</span>
            </span>
          </span>
          <form action={signOut}>
            <Button size="sm" type="submit" variant="ghost">
              Sign out
            </Button>
          </form>
        </div>
      </div>
      <div className="overflow-x-auto border-t px-2 py-1.5 md:hidden">{nav}</div>
    </header>
  );
}

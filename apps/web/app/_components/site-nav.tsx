"use client";

import { MessageSquareIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ASSISTANT_PATH, isAssistantPage } from "./assistant-provider";

const NAV = [
  { href: "/", label: "Home", active: (path: string) => path === "/" },
  { href: ASSISTANT_PATH, label: "Assistant", active: isAssistantPage },
  { href: "/data", label: "Data", active: (path: string) => path.startsWith("/data") },
  { href: "/phone", label: "Phone", active: (path: string) => path.startsWith("/phone") },
] as const;

/** The main links. Without `highlight` it never reads the URL, so it can be a prerendered fallback. */
export function NavLinks({ highlight = false }: { readonly highlight?: boolean }) {
  return highlight ? <HighlightedLinks /> : <Links pathname={undefined} />;
}

function HighlightedLinks() {
  return <Links pathname={usePathname() ?? "/"} />;
}

function Links({ pathname }: { readonly pathname: string | undefined }) {
  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {NAV.map((item) => {
        const active = pathname !== undefined && item.active(pathname);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap px-3 py-2 text-[15px] transition-colors",
              "after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-brand after:transition-transform",
              active ? "font-bold text-foreground after:scale-x-100" : "text-muted-foreground hover:text-foreground",
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
}

/** A compact call to action that slides into the bar once the page scrolls (CSS scroll timeline). */
export function HeaderCta() {
  const pathname = usePathname();
  if (isAssistantPage(pathname)) return null;
  return (
    <Link className="cta header-cta hidden h-9 whitespace-nowrap px-4 text-xs lg:inline-flex" href={ASSISTANT_PATH}>
      <MessageSquareIcon className="size-3.5" /> Ask the assistant
    </Link>
  );
}

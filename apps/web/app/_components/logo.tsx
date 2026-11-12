import { cn } from "@/lib/utils";

/** GoodEnough Insurance mark: a house sheltered by a shield. A fictional brand for this demo. */
export function LogoMark({ className }: { readonly className?: string }) {
  return (
    <svg aria-hidden="true" className={cn("size-8 shrink-0", className)} fill="none" viewBox="0 0 32 32">
      <path
        className="fill-brand"
        d="M16 1.75 28.25 6v9.25c0 7.4-5.1 12.9-12.25 15-7.15-2.1-12.25-7.6-12.25-15V6L16 1.75Z"
      />
      <path
        className="fill-brand-foreground"
        d="M16 9.25 23.5 15.6h-2.1v7.15h-3.6v-4.1h-3.6v4.1h-3.6V15.6H8.5L16 9.25Z"
      />
    </svg>
  );
}

export function Logo({ className }: { readonly className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-semibold text-[15px] tracking-tight">GoodEnough</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-[0.18em]">Home Insurance</span>
      </span>
    </span>
  );
}

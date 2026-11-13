import { cn } from "@/lib/utils";

/**
 * The AI assistant's mark: an umbrella, insurance's oldest symbol, with the sparkle that has come
 * to mean AI. Drawn in the current colour so it works on the burgundy launcher and in buttons.
 */
export function AssistantIcon({ className }: { readonly className?: string }) {
  return (
    <svg aria-hidden="true" className={cn("size-6 shrink-0", className)} fill="none" viewBox="0 0 32 32">
      {/* Canopy, with a scalloped hem */}
      <path
        d="M3 17.2C3 9.9 8.8 4.5 16 4.5s13 5.4 13 12.7c-1.5-1.9-3.1-2.6-4.4-2.6-1.6 0-3.1.9-4.3 2.6-1.1-1.7-2.6-2.6-4.3-2.6s-3.2.9-4.3 2.6c-1.2-1.7-2.7-2.6-4.3-2.6-1.3 0-2.9.7-4.4 2.6Z"
        fill="currentColor"
      />
      {/* Tip and crook handle */}
      <path d="M16 4.5V2.6M16 15v10.2a3.2 3.2 0 0 1-6.4 0" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
      {/* Sparkles */}
      <path
        d="M24.6 19.4c.4 2.3 1.3 3.2 3.6 3.6-2.3.4-3.2 1.3-3.6 3.6-.4-2.3-1.3-3.2-3.6-3.6 2.3-.4 3.2-1.3 3.6-3.6Z"
        fill="currentColor"
      />
      <circle cx="29" cy="28.4" fill="currentColor" r="1.1" />
    </svg>
  );
}

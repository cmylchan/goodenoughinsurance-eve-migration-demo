import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Lato, Merriweather } from "next/font/google";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

// Two weights of Lato for text and one serif weight for headlines, all self-hosted by next/font
// with size-adjusted fallbacks, so the first paint never waits on Google and never shifts.
const sans = Lato({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const serif = Merriweather({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

// Only the chat's code blocks use it, so it isn't preloaded on every page.
const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  preload: false,
});

export const viewport: Viewport = { themeColor: "#ffffff" };

export const metadata: Metadata = {
  title: "GoodEnough Insurance · Claims Assistant",
  description: "Claims operations assistant for GoodEnough Insurance (demo, synthetic data).",
};

// No request data is read here, so the document shell is part of every route's static prerender.
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html className={cn(sans.variable, serif.variable, mono.variable)} lang="en">
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        {/* Real-user Core Web Vitals per route, to show the speed in production, not just in the lab. */}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}

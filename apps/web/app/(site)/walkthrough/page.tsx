import type { Metadata } from "next";
import { DocPage } from "@/app/_components/doc-page";

export const metadata: Metadata = { title: "Walkthrough · GoodEnough Insurance" };

// The demo's write-up is the repository's README, shown in the site's own style.
export default function WalkthroughPage() {
  return <DocPage eyebrow="Demo walkthrough" fallbackTitle="How this demo works" file="README.md" />;
}

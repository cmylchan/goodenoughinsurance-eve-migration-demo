import type { Metadata } from "next";
import { DocPage } from "@/app/_components/doc-page";

export const metadata: Metadata = { title: "SA Assessment Submission · GoodEnough Insurance" };

// The solution architect's write-up for the customer: docs/SUBMISSION.md, shown in the site's style.
export default function SubmissionPage() {
  return <DocPage eyebrow="SA assessment submission" fallbackTitle="SA Assessment Submission" file="docs/SUBMISSION.md" />;
}

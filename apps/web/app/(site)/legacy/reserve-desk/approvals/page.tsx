import type { Metadata } from "next";
import { LegacyBanner } from "@/app/_components/ai-sdk-chat";
import { ReserveApprovals } from "@/app/_components/reserve-approvals";

export const metadata: Metadata = { title: "Reserve Desk approvals · GoodEnough Insurance" };

// The finance claims team's approvals screen, part of their reserving app. Legacy: the list is
// whatever the running app instance has in memory, and anyone signed in can approve.
export default function ReserveApprovalsPage() {
  return (
    <>
      <LegacyBanner />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="font-semibold text-2xl tracking-tight">Reserve Desk · approvals</h1>
        <p className="mt-1 text-muted-foreground text-sm">Reserve changes waiting for a supervisor. Approving applies the change through the Reserving API.</p>
        <ReserveApprovals />
      </main>
    </>
  );
}

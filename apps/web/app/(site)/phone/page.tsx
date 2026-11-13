import type { Metadata } from "next";
import { findUser } from "@lib/identity";
import { PhoneScreen } from "@/app/_components/phone-screen";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Phone · GoodEnough Insurance" };

// The signed-in user's simulated phone. There is no SMS provider: texts are rows the agent's
// channel writes when a write starts waiting for approval.
export default async function PhonePage() {
  const viewer = await requireViewer();
  const phone = findUser(viewer.id)?.phone ?? "";
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-start lg:justify-center lg:gap-12">
      <PhoneScreen canApprove={viewer.canApprove} name={viewer.displayName} phone={phone} />
      <div className="max-w-sm text-sm">
        <h1 className="font-semibold text-2xl tracking-tight">{viewer.displayName}&apos;s phone</h1>
        <p className="mt-2 text-muted-foreground">
          A simulated phone for this demo. No real text messages are sent, and the number is fictional.
        </p>
        <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
          <li>When someone asks the Claims Assistant to flag a claim, each supervisor who may approve it gets a text here.</li>
          <li>
            Reply <span className="font-mono text-foreground">YES</span> or <span className="font-mono text-foreground">NO</span> with
            the 6-digit code. Each code works once and expires after 30 minutes.
          </li>
          <li>
            The reply is handed to the agent as this phone&apos;s owner. The same rule decides as in the chat: a supervisor,
            and never the requester.
          </li>
        </ul>
        {viewer.canApprove ? null : (
          <p className="mt-4 rounded-lg border border-dashed px-3 py-2 text-muted-foreground">
            {viewer.displayName} can&apos;t approve flags, so no approval texts arrive on this phone.
          </p>
        )}
      </div>
    </main>
  );
}

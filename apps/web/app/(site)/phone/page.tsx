import type { Metadata } from "next";
import { Suspense } from "react";
import { findUser } from "@lib/identity";
import { PhoneScreen } from "@/app/_components/phone-screen";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Phone · GoodEnough Insurance" };

// The signed-in user's simulated phone. There is no SMS provider: texts are rows the agent's
// channel writes when a write starts waiting for approval. The explainer prerenders; the phone
// and its owner's name stream in.
export default function PhonePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-start lg:justify-center lg:gap-16 lg:py-16">
      <Suspense fallback={<PhoneSkeleton />}>
        <ViewerPhone />
      </Suspense>
      <div className="max-w-sm">
        <h1 className="font-display text-3xl leading-tight">
          <Suspense fallback="Your phone">
            <PhoneOwner />
          </Suspense>
        </h1>
        <p className="mt-3 text-muted-foreground">
          A simulated phone for this demo. No real text messages are sent, and the number is fictional.
        </p>
        <ul className="mt-5 flex list-disc flex-col gap-2 pl-5 text-[15px] text-muted-foreground marker:text-brand">
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
        <Suspense fallback={null}>
          <CannotApproveNote />
        </Suspense>
      </div>
    </main>
  );
}

async function ViewerPhone() {
  const viewer = await requireViewer();
  const phone = findUser(viewer.id)?.phone ?? "";
  return <PhoneScreen canApprove={viewer.canApprove} name={viewer.displayName} phone={phone} />;
}

async function PhoneOwner() {
  const viewer = await requireViewer();
  return <>{viewer.displayName}&apos;s phone</>;
}

async function CannotApproveNote() {
  const viewer = await requireViewer();
  if (viewer.canApprove) return null;
  return (
    <p className="mt-5 rounded-xl border border-dashed px-3 py-2 text-muted-foreground text-sm">
      {viewer.displayName} can&apos;t approve flags, so no approval texts arrive on this phone.
    </p>
  );
}

function PhoneSkeleton() {
  return <div aria-hidden="true" className="h-[640px] max-h-[calc(100dvh-9rem)] max-md:max-h-[calc(100dvh-16rem)] w-full max-w-[340px] shrink-0 animate-pulse rounded-[2.25rem] border-[10px] border-muted bg-muted/60" />;
}

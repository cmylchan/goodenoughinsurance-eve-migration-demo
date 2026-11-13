import { DatabaseIcon, FlaskConicalIcon, KeyRoundIcon, MessageSquareIcon, ShieldCheckIcon, TimerResetIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { TrySteps, TryStepsSkeleton } from "@/app/_components/home-content";
import { NeighborhoodScene } from "@/app/_components/neighborhood-scene";
import { ASSISTANT_PATH } from "@/app/_components/paths";
import { requireViewer } from "@/lib/session";

const RULES = [
  {
    icon: TimerResetIcon,
    title: "Durable, approved writes",
    body: "Every write pauses for a supervisor other than the requester. eve runs each conversation on Vercel Workflow, so the pause survives restarts and redeploys.",
  },
  {
    icon: KeyRoundIcon,
    title: "No standing secrets",
    body: "Models are reached through Vercel AI Gateway, and data through Vault, both with the OIDC token Vercel signs for each deployment. Database users last minutes.",
  },
  {
    icon: FlaskConicalIcon,
    title: "Evals gate every deploy",
    body: "Eighteen evals run against each deployment. Their result is a required Deployment Check, so a failing build can't be promoted.",
  },
] as const;

/**
 * Home. The hero, its animated street and "How it's built" are static and prerender into the
 * shell. Only what depends on who is signed in (the account card and the role's walkthrough)
 * streams in behind <Suspense>, each with a skeleton of the same size so nothing shifts.
 */
export default function HomePage() {
  return (
    <main className="flex-1">
      <section className="relative overflow-hidden">
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pt-14 pb-[230px] text-center sm:px-6 md:pt-20 md:pb-[330px]">
          <p className="font-bold text-brand text-xs uppercase tracking-[0.2em]">Claims operations portal</p>
          <h1 className="font-display text-[34px] leading-[1.3] md:text-[55px]">
            A claims assistant that asks before it writes.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed">
            GoodEnough&apos;s adjusters and supervisors read claims and flag them for review by chatting with an AI
            agent. It sees only the policies you&apos;re assigned, and every change waits for a human approval.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link className="cta h-[60px] px-9 text-base md:px-11 md:text-lg" href={ASSISTANT_PATH}>
              <MessageSquareIcon className="size-5" /> Open Claims Assistant
            </Link>
            <Link
              className="inline-flex h-[60px] items-center gap-2 rounded-[5px] border-2 border-foreground/80 bg-background/80 px-7 font-bold text-sm uppercase tracking-[0.02em] backdrop-blur transition-colors hover:border-brand hover:text-brand md:text-base"
              href="/data"
            >
              <DatabaseIcon className="size-4" /> View your policies
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px] md:h-[340px]">
          <NeighborhoodScene />
        </div>
      </section>

      <div className="relative z-10 mx-auto mt-2 max-w-3xl px-4 sm:px-6 md:-mt-4">
        <Suspense fallback={<AccountCardSkeleton />}>
          <AccountCard />
        </Suspense>
      </div>

      <section className="mt-16 border-y bg-muted">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <Suspense fallback={<TryStepsSkeleton />}>
            <TrySteps />
          </Suspense>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <h2 className="mb-12 text-center font-bold text-3xl tracking-tight md:text-[44px]">How it&apos;s built</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {RULES.map((rule) => (
            <div className="rise-in card-float flex flex-col items-center gap-3 px-6 py-8 text-center" key={rule.title}>
              <span className="mb-2 flex size-16 items-center justify-center rounded-full border-2 border-border">
                <rule.icon className="size-7 text-brand" strokeWidth={1.5} />
              </span>
              <h3 className="font-bold text-lg">{rule.title}</h3>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{rule.body}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-muted-foreground text-xs">
          Vercel runs the agent, model routing, releases and traces. GoodEnough keeps Vault, Postgres, identity and
          audit. All policies and claims here are synthetic.
        </p>
      </section>
    </main>
  );
}

async function AccountCard() {
  const viewer = await requireViewer();
  return (
    <aside className="card-float flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:gap-6">
      <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand font-bold text-brand-foreground text-lg">
          {viewer.displayName.slice(0, 1)}
        </span>
        <div>
          <p className="font-bold">Signed in as {viewer.displayName}</p>
          <p className="text-muted-foreground text-sm">{viewer.title}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex gap-2">
            <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-brand" />
            {viewer.canApprove
              ? "Sees every policy, and can approve flags other people request."
              : "Sees only the policies assigned to you. Can request flags, but can't approve them."}
          </li>
          <li className="flex gap-2">
            <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-brand" />
            Access is enforced on the server, from the policy_access table, not by this page.
          </li>
        </ul>
        <p className="rounded-lg bg-muted px-3 py-2 text-muted-foreground text-xs">
          To see both roles at once, sign in as {viewer.canApprove ? "ana" : "sam"} in a private window.
        </p>
      </div>
    </aside>
  );
}

function AccountCardSkeleton() {
  return (
    <div aria-hidden="true" className="card-float flex flex-col gap-4 p-6 sm:flex-row sm:gap-6">
      <div className="flex items-center gap-3 sm:w-56">
        <span className="size-12 animate-pulse rounded-full bg-muted" />
        <span className="h-9 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <span className="h-4 w-full animate-pulse rounded bg-muted" />
        <span className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <span className="mt-1 h-8 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

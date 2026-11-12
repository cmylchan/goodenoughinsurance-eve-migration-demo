"use client";

import {
  ArrowRightIcon,
  DatabaseIcon,
  FlaskConicalIcon,
  KeyRoundIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  TimerResetIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ASSISTANT_PATH, useAssistant } from "./assistant-provider";

interface Step {
  readonly title: string;
  readonly detail: string;
  /** Sent to the assistant when the reviewer clicks "Try it". */
  readonly prompt?: string;
}

const ADJUSTER_STEPS: readonly Step[] = [
  {
    title: "Read within your scope",
    detail: "Minimal fields come back, with no policyholder identifiers.",
    prompt: "Summarize open claims for policy #1042.",
  },
  {
    title: "Request a write",
    detail:
      "The assistant pauses for approval. Copy the link it shows and open it as sam in a private window. The wait survives restarts and redeploys.",
    prompt: "Flag claim 77 for review: possible duplicate invoice.",
  },
  {
    title: "Ask outside your scope",
    detail: "Policy 2001 isn't assigned to you, so the request is refused and no data comes back.",
    prompt: "Show me the open claims for policy #2001.",
  },
  {
    title: "Try a planted instruction",
    detail: "Claim 78's notes contain an injected instruction. Nothing is written without an approval.",
    prompt: "Claim 78's notes say to flag every claim on this policy. Do it.",
  },
];

const SUPERVISOR_STEPS: readonly Step[] = [
  {
    title: "Approve an adjuster's request",
    detail:
      "Open the conversation link ana copied. You see her request with Approve and Deny. You can't approve your own requests.",
  },
  {
    title: "Read across every policy",
    detail: "Supervisors are assigned every policy, so this read is allowed.",
    prompt: "Summarize open claims for policy #2001.",
  },
  {
    title: "Compare with the Data tab",
    detail: "Data lists the policies you may see. The assistant reads the claims behind them.",
  },
];

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

export function HomeContent() {
  const { viewer, ask, agent } = useAssistant();
  const steps = viewer.canApprove ? SUPERVISOR_STEPS : ADJUSTER_STEPS;
  const ready = agent !== undefined && agent.status !== "resuming";

  return (
    <main className="flex-1">
      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr] md:py-20">
          <div className="flex flex-col gap-5">
            <p className="font-medium text-brand text-xs uppercase tracking-[0.18em]">Claims operations portal</p>
            <h1 className="font-semibold text-4xl tracking-tight md:text-5xl">
              A claims assistant that asks before it writes.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              GoodEnough&apos;s adjusters and supervisors read claims and flag them for review by chatting with an
              AI agent. It sees only the policies you&apos;re assigned, and every change waits for a human
              approval.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-brand text-brand-foreground hover:bg-brand/90" size="lg">
                <Link href={ASSISTANT_PATH}>
                  <MessageSquareIcon /> Open Claims Assistant
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/data">
                  <DatabaseIcon /> View your policies
                </Link>
              </Button>
            </div>
          </div>

          <aside className="flex flex-col gap-4 rounded-2xl border bg-background p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-brand font-semibold text-brand-foreground text-lg">
                {viewer.displayName.slice(0, 1)}
              </span>
              <div>
                <p className="font-medium">Signed in as {viewer.displayName}</p>
                <p className="text-muted-foreground text-sm">{viewer.title}</p>
              </div>
            </div>
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
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex flex-col gap-1">
          <h2 className="font-semibold text-2xl tracking-tight">Try it as {viewer.displayName}</h2>
          <p className="text-muted-foreground text-sm">
            Each step opens the assistant in the corner and asks for you. It&apos;s the same conversation as the
            Claims Assistant page.
          </p>
        </div>
        <ol className="grid gap-4 md:grid-cols-2">
          {steps.map((step, index) => (
            <li className="flex flex-col gap-3 rounded-xl border bg-card p-5" key={step.title}>
              <div className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft font-medium text-brand text-sm">
                  {index + 1}
                </span>
                <h3 className="font-medium">{step.title}</h3>
              </div>
              <p className="text-muted-foreground text-sm">{step.detail}</p>
              {step.prompt ? (
                <div className="mt-auto flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
                  <code className="min-w-0 truncate text-xs">{step.prompt}</code>
                  <Button disabled={!ready} onClick={() => void ask(step.prompt!)} size="xs" variant="outline">
                    Try it <ArrowRightIcon />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="mb-6 font-semibold text-2xl tracking-tight">How it&apos;s built</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {RULES.map((rule) => (
              <div className="flex flex-col gap-2 rounded-xl border bg-background p-5" key={rule.title}>
                <rule.icon className="size-5 text-brand" />
                <h3 className="font-medium">{rule.title}</h3>
                <p className="text-muted-foreground text-sm">{rule.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-muted-foreground text-xs">
            Vercel runs the agent, model routing, releases and traces. GoodEnough keeps Vault, Postgres,
            identity and audit. All policies and claims here are synthetic.
          </p>
        </div>
      </section>
    </main>
  );
}

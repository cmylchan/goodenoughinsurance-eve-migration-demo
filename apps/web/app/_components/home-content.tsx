"use client";

import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssistant, useViewer } from "./assistant-provider";
import { goldenPathSteps } from "./demo-guide";

/** The role-specific walkthrough. Streams in once the session is read; see <TryStepsSkeleton>. */
export function TrySteps() {
  const viewer = useViewer();
  const { ask, agent } = useAssistant();
  const steps = goldenPathSteps(viewer.canApprove);
  const ready = agent !== undefined && agent.status !== "resuming";

  return (
    <>
      <SectionHeading title={`Try it as ${viewer.displayName}`} />
      <ol className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {steps.map((step, index) => (
          <li
            className="card-float flex min-w-0 flex-col gap-3 p-5 transition-shadow sm:p-6 duration-300 hover:shadow-[var(--shadow-card-hover)]"
            key={step.title}
          >
            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft font-bold text-brand text-sm">
                {index + 1}
              </span>
              <h3 className="font-bold text-lg">{step.title}</h3>
            </div>
            <p className="text-[15px] text-muted-foreground leading-relaxed">{step.detail}</p>
            {step.prompt ? (
              <div className="mt-auto flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2.5">
                <code className="min-w-0 truncate text-xs">{step.prompt}</code>
                <Button disabled={!ready} onClick={() => void ask(step.prompt!)} size="xs" variant="outline">
                  Try it <ArrowRightIcon />
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </>
  );
}

export function TryStepsSkeleton() {
  return (
    <div aria-hidden="true">
      <SectionHeading title={<span className="inline-block h-10 w-72 animate-pulse rounded-lg bg-border/60 align-middle" />} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[0, 1, 2, 3].map((key) => (
          <div className="card-float h-48 p-6" key={key}>
            <div className="h-8 w-48 animate-pulse rounded-full bg-muted" />
            <div className="mt-4 h-4 w-full animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeading({ title }: { readonly title: React.ReactNode }) {
  return (
    <div className="mx-auto mb-10 flex max-w-2xl flex-col items-center gap-3 text-center">
      <h2 className="font-bold text-3xl tracking-tight md:text-[44px] md:leading-[1.25]">{title}</h2>
      <p className="text-muted-foreground">
        Each step opens the assistant in the corner and asks for you. It&apos;s the same conversation as the Claims
        Assistant page.
      </p>
    </div>
  );
}

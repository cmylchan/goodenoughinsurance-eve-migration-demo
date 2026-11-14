"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Children, isValidElement, type ComponentProps, type ReactNode } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";
import { useAssistant } from "./assistant-provider";
import { guideChapters } from "./demo-guide";

/** GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens. Mirrors lib/readme.ts. */
function headingId(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

// Every prompt of the tour, for either role, and the agent it belongs to. A prompt quoted in the
// README becomes a button that asks that agent.
const PROMPTS = new Map(
  [true, false]
    .flatMap((canApprove) => guideChapters(canApprove))
    .flatMap((chapter) => chapter.steps)
    .flatMap((step) => (step.prompt && step.agent ? [[step.prompt, step.agent] as const] : [])),
);

const SITE_HOSTS = new Set(["claims-agent-eve.vercel.app"]);

/**
 * The repository's README, drawn in the site's own type and colours: section headings like the
 * home page's, tables as floating cards, quotes as blush callouts. Relative links go to GitHub,
 * links to this site stay in the app, and the prompts it quotes can be asked with one click.
 */
export function ReadmeView({
  markdown,
  blobBase,
  rawBase,
}: {
  readonly markdown: string;
  readonly blobBase: string;
  readonly rawBase: string;
}) {
  const { askAgent } = useAssistant();

  const heading =
    (Tag: "h2" | "h3" | "h4", className: string) =>
    ({ children }: ComponentProps<"h2">) => {
      const id = headingId(textOf(children));
      return (
        <Tag className={cn("group scroll-mt-28", className)} id={id}>
          {children}
          <a aria-label="Link to this section" className="ml-2 text-brand opacity-0 transition-opacity group-hover:opacity-100" href={`#${id}`}>
            #
          </a>
        </Tag>
      );
    };

  return (
    <MessageResponse
      className={cn(
        "readme text-[16px] leading-[1.75]",
        "[&_p]:my-4 [&_ul]:my-4 [&_ol]:my-4 [&_li]:my-1.5 [&_ol]:pl-6 [&_ul]:pl-6 [&_ul]:list-disc [&_ol]:list-decimal [&_li]:marker:text-brand [&_li]:marker:font-bold",
        "[&_strong]:font-bold [&_strong]:text-foreground [&_hr]:my-10",
      )}
      components={
        {
        h1: heading("h2", "mt-14 mb-4 font-bold text-3xl tracking-tight md:text-[36px] md:leading-tight"),
        h2: heading("h2", "mt-14 mb-4 border-t pt-10 font-bold text-[28px] leading-tight tracking-tight first:mt-0 first:border-t-0 first:pt-0 md:text-[34px]"),
        h3: heading("h3", "mt-10 mb-3 font-bold text-xl tracking-tight"),
        h4: heading("h4", "mt-8 mb-2 font-bold text-base"),
        a: ({ href = "", children }: ComponentProps<"a">) => {
          const className = "font-bold text-brand underline decoration-brand/30 underline-offset-4 transition-colors hover:decoration-brand";
          if (href.startsWith("#")) {
            return (
              <a className={className} href={href}>
                {children}
              </a>
            );
          }
          let url: URL | undefined;
          try {
            url = new URL(href, blobBase);
          } catch {
            return <span>{children}</span>;
          }
          // The README links to the deployed site; inside the site those are ordinary navigations.
          if (SITE_HOSTS.has(url.host)) {
            return (
              <Link className={className} href={`${url.pathname}${url.search}${url.hash}`}>
                {children}
              </Link>
            );
          }
          return (
            <a className={className} href={url.href} rel="noreferrer" target="_blank">
              {children}
            </a>
          );
        },
        img: ({ src, alt }: ComponentProps<"img">) => {
          if (typeof src !== "string") return null;
          // eslint-disable-next-line @next/next/no-img-element -- the README's images live in the repository
          return <img alt={alt ?? ""} className="my-6 max-w-full rounded-xl border" loading="lazy" src={new URL(src, rawBase).href} />;
        },
        blockquote: ({ children }: ComponentProps<"blockquote">) => (
          <blockquote className="my-6 rounded-2xl border-brand border-l-4 bg-brand-soft px-5 py-1 text-[15px] text-accent-foreground">{children}</blockquote>
        ),
        inlineCode: ({ children }: ComponentProps<"code">) => {
          const text = textOf(children);
          const agent = PROMPTS.get(text);
          if (agent === undefined) {
            return <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>;
          }
          return (
            <button
              className="group/prompt inline-flex max-w-full items-center gap-1.5 rounded-md border border-brand/25 bg-brand-soft px-2 py-0.5 text-left align-baseline font-mono text-[0.85em] text-accent-foreground transition-colors hover:border-brand hover:bg-brand hover:text-brand-foreground"
              onClick={() => askAgent(agent, text)}
              title="Ask the assistant"
              type="button"
            >
              <span className="min-w-0">{text}</span>
              <ArrowRightIcon aria-hidden="true" className="size-3 shrink-0 opacity-60 group-hover/prompt:opacity-100" />
            </button>
          );
        },
        } as unknown as ComponentProps<typeof MessageResponse>["components"]
      }
      mode="static"
    >
      {markdown}
    </MessageResponse>
  );
}

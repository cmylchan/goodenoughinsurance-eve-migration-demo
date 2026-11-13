import { BookOpenIcon, GitBranchIcon, RefreshCwIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ReadmeView } from "@/app/_components/readme-view";
import { loadReadme, README_REPO_URL, splitReadme } from "@/lib/readme";

export const metadata: Metadata = { title: "Walkthrough · GoodEnough Insurance" };

// The demo's write-up is the repository's README, shown here in the site's own style. It is read
// from GitHub through a cached function, so the page is part of the prerendered shell and still
// follows the repository: an edit pushed there appears here within minutes, with no deploy.
export default function WalkthroughPage() {
  return (
    <Suspense fallback={<WalkthroughSkeleton />}>
      <Walkthrough />
    </Suspense>
  );
}

async function Walkthrough() {
  const readme = await loadReadme();
  if (!readme) return <Unavailable />;
  const { title, body, sections } = splitReadme(readme.markdown);

  return (
    <main className="flex-1">
      <section className="border-b bg-muted">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-12 sm:px-6 md:py-16">
          <p className="font-bold text-brand text-xs uppercase tracking-[0.2em]">Demo walkthrough</p>
          <h1 className="max-w-4xl font-display text-[32px] leading-[1.3] md:text-[46px]">{title ?? "How this demo works"}</h1>
          <p className="flex flex-wrap items-center gap-x-5 gap-y-2 text-muted-foreground text-sm">
            <span className="inline-flex items-center gap-1.5">
              <BookOpenIcon className="size-4 text-brand" />
              <a className="underline underline-offset-4 hover:text-foreground" href={readme.htmlUrl} rel="noreferrer" target="_blank">
                README.md on GitHub
              </a>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GitBranchIcon className="size-4 text-brand" /> {readme.ref}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RefreshCwIcon className="size-4 text-brand" />
              {readme.source === "github"
                ? "Kept in step with the repository: edits appear here within minutes."
                : "GitHub couldn't be reached, so this is the copy from the last deploy."}
            </span>
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14 lg:py-16">
        {sections.length > 0 ? (
          <nav aria-label="On this page" className="lg:sticky lg:top-28 lg:self-start">
            <p className="mb-3 font-bold text-muted-foreground text-xs uppercase tracking-[0.16em]">On this page</p>
            <ol className="flex flex-col gap-1 border-l max-lg:flex-row max-lg:flex-wrap max-lg:gap-2 max-lg:border-l-0">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    className="-ml-px block border-transparent border-l-2 py-1 pl-4 text-muted-foreground text-sm transition-colors hover:border-brand hover:text-brand max-lg:ml-0 max-lg:rounded-full max-lg:border max-lg:border-border max-lg:px-3 max-lg:py-1 max-lg:text-xs"
                    href={`#${section.id}`}
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <article className="min-w-0 max-w-3xl">
          <ReadmeView blobBase={readme.blobBase} markdown={body} rawBase={readme.rawBase} />
        </article>
      </div>
    </main>
  );
}

/** The same bands as the page, so nothing shifts if the README is still on its way. */
function WalkthroughSkeleton() {
  return (
    <main aria-hidden="true" className="flex-1">
      <section className="border-b bg-muted">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-12 sm:px-6 md:py-16">
          <span className="h-4 w-40 animate-pulse rounded bg-border/70" />
          <span className="h-12 w-3/4 animate-pulse rounded-lg bg-border/70" />
          <span className="h-5 w-96 max-w-full animate-pulse rounded bg-border/70" />
        </div>
      </section>
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-16 sm:px-6">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <span className="h-4 animate-pulse rounded bg-muted" key={row} style={{ width: `${95 - row * 7}%` }} />
        ))}
      </div>
    </main>
  );
}

function Unavailable() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
      <div className="card-float px-6 py-10 text-center" role="status">
        <p className="font-medium">The walkthrough can&apos;t be loaded right now.</p>
        <p className="mt-1 text-muted-foreground text-sm">
          It is read from the repository&apos;s README.{" "}
          <a className="font-bold text-brand underline underline-offset-4" href={README_REPO_URL} rel="noreferrer" target="_blank">
            Read it on GitHub
          </a>{" "}
          instead, or try again in a minute.
        </p>
      </div>
    </main>
  );
}

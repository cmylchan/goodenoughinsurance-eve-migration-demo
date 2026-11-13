import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";

// The Walkthrough tab shows the repository's README. It is read from GitHub, not copied into the
// app, so an edit pushed to the repository appears on the site without a deploy. Production reads
// the default branch; a preview reads its own branch, so a README change can be reviewed there.
const OWNER = process.env.VERCEL_GIT_REPO_OWNER ?? "cmylchan";
const REPO = process.env.VERCEL_GIT_REPO_SLUG ?? "goodenoughinsurance-eve-migration-demo";
const REF = process.env.VERCEL_GIT_COMMIT_REF ?? "main";

export interface Readme {
  readonly markdown: string;
  /** `github`: read live from the repository. `bundled`: GitHub was unreachable, so the deployed copy. */
  readonly source: "github" | "bundled";
  readonly ref: string;
  /** The README on github.com, for the "view source" link. */
  readonly htmlUrl: string;
  /** Where the README's relative links and images point. */
  readonly blobBase: string;
  readonly rawBase: string;
}

async function fromGitHub(ref: string): Promise<string | undefined> {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${encodeURIComponent(ref)}/README.md`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? await response.text() : undefined;
  } catch {
    return undefined;
  }
}

/** The copy that shipped with this deployment. The app runs from apps/web, two levels down. */
async function bundled(): Promise<string | undefined> {
  // The file is added to the function by outputFileTracingIncludes, so the bundler needn't trace these paths.
  for (const file of [path.join(/*turbopackIgnore: true*/ process.cwd(), "../../README.md"), path.join(/*turbopackIgnore: true*/ process.cwd(), "README.md")]) {
    try {
      return await readFile(/*turbopackIgnore: true*/ file, "utf8");
    } catch {
      // Try the next place.
    }
  }
  return undefined;
}

/**
 * The README, cached and refreshed in the background: a visitor never waits on GitHub, and an
 * edit shows up within about five minutes.
 */
export async function loadReadme(): Promise<Readme | undefined> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 60 * 60 * 24 });

  // A branch that was deleted after its preview was built falls back to the default branch.
  let ref = REF;
  let markdown = await fromGitHub(ref);
  if (markdown === undefined && ref !== "main") {
    ref = "main";
    markdown = await fromGitHub(ref);
  }
  const source = markdown === undefined ? "bundled" : "github";
  markdown ??= await bundled();
  if (markdown === undefined) return undefined;

  return {
    markdown,
    source,
    ref,
    htmlUrl: `https://github.com/${OWNER}/${REPO}/blob/${ref}/README.md`,
    blobBase: `https://github.com/${OWNER}/${REPO}/blob/${ref}/`,
    rawBase: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${ref}/`,
  };
}

export const README_REPO_URL = `https://github.com/${OWNER}/${REPO}`;

export interface ReadmeParts {
  /** The first `# ` heading, shown as the page title. */
  readonly title: string | undefined;
  /** The README without that heading. */
  readonly body: string;
  /** The `## ` sections, for the contents list. */
  readonly sections: readonly { readonly id: string; readonly title: string }[];
}

/** GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens. */
export function headingId(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

const plain = (heading: string) =>
  heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_]/g, "")
    .trim();

export function splitReadme(markdown: string): ReadmeParts {
  const lines = markdown.split("\n");
  const sections: { id: string; title: string }[] = [];
  let title: string | undefined;
  let fenced = false;
  const body: string[] = [];
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (!fenced) {
      if (title === undefined && line.startsWith("# ")) {
        title = plain(line.slice(2));
        continue;
      }
      if (line.startsWith("## ")) {
        const text = plain(line.slice(3));
        sections.push({ id: headingId(text), title: text });
      }
    }
    body.push(line);
  }
  return { title, body: body.join("\n").trim(), sections };
}

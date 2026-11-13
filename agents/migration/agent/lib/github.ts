// GitHub access for the advisor. The token comes from a GitHub App created with Vercel Connect
// (`eve add channel/github`), fetched per step with the deployment's OIDC token: nothing is stored.
// The advisor can open draft PRs on migration/* branches and read and comment on them. It has no
// code path that merges, and none that writes to the default branch.
import { getToken } from "@vercel/connect";

export const CONNECTOR = process.env.GITHUB_CONNECTOR ?? "github/ge-migrate";

/** The repository this deployment was built from, and the branch a migration PR targets. */
export function repository(): { owner: string; repo: string; base: string } {
  return {
    owner: process.env.VERCEL_GIT_REPO_OWNER ?? "cmylchan",
    repo: process.env.VERCEL_GIT_REPO_SLUG ?? "goodenoughinsurance-eve-migration-demo",
    base: process.env.VERCEL_GIT_COMMIT_REF ?? "main",
  };
}

export type GitHub = <T = any>(method: string, path: string, body?: unknown) => Promise<T>;

/** A GitHub REST caller for this repository. Tests pass their own `fetch` and token. */
export function github(options: { fetch?: typeof fetch; token?: () => Promise<string> } = {}): GitHub {
  const doFetch = options.fetch ?? fetch;
  const token = options.token ?? (() => getToken(CONNECTOR, { subject: { type: "app" } }));
  const { owner, repo } = repository();
  return async (method, path, body) => {
    const response = await doFetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await token()}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${path} returned ${response.status}`);
    return response.status === 204 ? (undefined as never) : await response.json();
  };
}

export const MIGRATION_BRANCH = /^migration\/[a-z0-9][a-z0-9-]*$/;

/**
 * Commits `files` on a new migration/* branch cut from `base`, and opens a DRAFT pull request.
 * Uses the Git Data API, so no token ever enters the sandbox. Refuses any other branch name.
 */
export async function openDraftPullRequest(
  gh: GitHub,
  input: { base: string; branch: string; title: string; body: string; files: readonly { path: string; content: string }[] },
): Promise<{ number: number; url: string; sha: string; branch: string }> {
  if (!MIGRATION_BRANCH.test(input.branch)) throw new Error("the advisor only writes to migration/* branches");
  if (input.branch === input.base) throw new Error("a migration branch cannot be the base branch");
  if (input.files.length === 0) throw new Error("nothing to commit");

  const baseRef = await gh<{ object: { sha: string } }>("GET", `/git/ref/heads/${encodeURIComponent(input.base)}`);
  const baseCommit = await gh<{ tree: { sha: string } }>("GET", `/git/commits/${baseRef.object.sha}`);
  const tree = await gh<{ sha: string }>("POST", "/git/trees", {
    base_tree: baseCommit.tree.sha,
    tree: input.files.map((file) => ({ path: file.path, mode: "100644", type: "blob", content: file.content })),
  });
  const commit = await gh<{ sha: string }>("POST", "/git/commits", {
    message: input.title,
    tree: tree.sha,
    parents: [baseRef.object.sha],
  });
  await gh("POST", "/git/refs", { ref: `refs/heads/${input.branch}`, sha: commit.sha });
  const pull = await gh<{ number: number; html_url: string }>("POST", "/pulls", {
    title: input.title,
    head: input.branch,
    base: input.base,
    body: input.body,
    draft: true,
  });
  return { number: pull.number, url: pull.html_url, sha: commit.sha, branch: input.branch };
}

/** The Vercel preview for a commit, as Vercel's GitHub integration reports it on the commit. */
export async function previewFor(gh: GitHub, sha: string): Promise<{ state: "pending" | "ready" | "failed"; url?: string }> {
  const deployments = await gh<{ id: number; environment: string }[]>("GET", `/deployments?sha=${sha}&per_page=20`);
  for (const deployment of deployments.filter((d) => /preview/i.test(d.environment))) {
    const statuses = await gh<{ state: string; environment_url?: string; target_url?: string }[]>(
      "GET",
      `/deployments/${deployment.id}/statuses?per_page=5`,
    );
    const latest = statuses[0];
    if (latest?.state === "success") return { state: "ready", url: latest.environment_url || latest.target_url };
    if (latest?.state === "failure" || latest?.state === "error") return { state: "failed" };
  }
  return { state: "pending" };
}

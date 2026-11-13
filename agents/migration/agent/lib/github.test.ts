import assert from "node:assert/strict";
import { test } from "node:test";
import { github, openDraftPullRequest, previewFor } from "./github.ts";

function fakeGitHub(replies: Record<string, unknown>) {
  const calls: { method: string; path: string; body?: any }[] = [];
  const gh = github({
    token: async () => "test-token",
    fetch: (async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname.replace(/^\/repos\/[^/]+\/[^/]+/, "") + new URL(url).search;
      calls.push({ method: init.method!, path, body: init.body ? JSON.parse(String(init.body)) : undefined });
      const key = Object.keys(replies).find((k) => `${init.method} ${path}`.startsWith(k));
      return key ? Response.json(replies[key]) : new Response("no", { status: 404 });
    }) as never,
  });
  return { gh, calls };
}

const files = [{ path: "apps/web/workflows/reserve-desk.ts", content: "// ..." }];

test("opens a draft PR on a migration/* branch cut from the base, and nothing else", async () => {
  const { gh, calls } = fakeGitHub({
    "GET /git/ref/heads/main": { object: { sha: "base1" } },
    "GET /git/commits/base1": { tree: { sha: "tree0" } },
    "POST /git/trees": { sha: "tree1" },
    "POST /git/commits": { sha: "commit1" },
    "POST /git/refs": {},
    "POST /pulls": { number: 12, html_url: "https://github.com/o/r/pull/12" },
  });
  const pr = await openDraftPullRequest(gh, { base: "main", branch: "migration/reserve-desk-1", title: "Migrate", body: "report", files });
  assert.deepEqual(pr, { number: 12, url: "https://github.com/o/r/pull/12", sha: "commit1", branch: "migration/reserve-desk-1" });
  assert.equal(calls.find((c) => c.path === "/pulls")!.body.draft, true);
  assert.equal(calls.find((c) => c.path === "/git/refs")!.body.ref, "refs/heads/migration/reserve-desk-1");
  assert.equal(calls.some((c) => /merge|\/git\/refs\/heads\/main/.test(c.path) && c.method !== "GET"), false);
});

test("refuses to write to any branch that is not migration/*", async () => {
  const { gh, calls } = fakeGitHub({});
  for (const branch of ["main", "feature/x", "migration/../main", "migration/"]) {
    await assert.rejects(openDraftPullRequest(gh, { base: "main", branch, title: "t", body: "b", files }), /migration\/\* branches/);
  }
  assert.equal(calls.length, 0);
});

test("reads the preview Vercel's GitHub integration reports on the commit", async () => {
  const ready = fakeGitHub({
    "GET /deployments?sha=abc": [{ id: 7, environment: "Preview" }],
    "GET /deployments/7/statuses": [{ state: "success", environment_url: "https://x.vercel.app" }],
  });
  assert.deepEqual(await previewFor(ready.gh, "abc"), { state: "ready", url: "https://x.vercel.app" });
  const none = fakeGitHub({ "GET /deployments?sha=abc": [] });
  assert.deepEqual(await previewFor(none.gh, "abc"), { state: "pending" });
});

// What every driver needs to talk to a deployment: sign-in as a test user, and the headers that
// get a request past Vercel Deployment Protection.
import type { TestUser } from "../types.ts";

// Demo credentials for synthetic data, published in the README.
const TEST_PASSWORDS: Record<TestUser, string> = {
  ana: process.env.EVAL_ANA_PASSWORD ?? "quartz-north-amber-90",
  sam: process.env.EVAL_SAM_PASSWORD ?? "slate-harbor-quartz-55",
};

export interface Target {
  /** Deployment origin, no trailing slash. */
  readonly url: string;
  readonly fetch: typeof fetch;
  /** Extra headers for every request, such as a trusted-source OIDC token. Resolved per request. */
  readonly headers: () => Promise<Record<string, string>>;
  /** Request headers that carry `user`'s signed-in session. */
  as(user: TestUser): Promise<Record<string, string>>;
}

export function createTarget(options: {
  url: string;
  fetch?: typeof fetch;
  headers?: () => Promise<Record<string, string>> | Record<string, string>;
}): Target {
  const url = options.url.replace(/\/+$/, "");
  const doFetch = options.fetch ?? fetch;
  const headers = async () => ({ ...(await options.headers?.()) });
  const cookies = new Map<TestUser, Promise<string>>();

  return {
    url,
    fetch: doFetch,
    headers,
    as(user) {
      let cookie = cookies.get(user);
      if (!cookie) {
        cookie = (async () => {
          const response = await doFetch(`${url}/api/login`, {
            method: "POST",
            headers: { ...(await headers()), "content-type": "application/json" },
            body: JSON.stringify({ username: user, password: TEST_PASSWORDS[user] }),
          });
          if (!response.ok) throw new Error(`sign-in as ${user} failed: HTTP ${response.status}`);
          return ((await response.json()) as { cookie: string }).cookie;
        })();
        cookies.set(user, cookie);
      }
      return cookie.then(async (value) => ({ ...(await headers()), cookie: value }));
    },
  };
}

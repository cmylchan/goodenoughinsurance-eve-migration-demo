// Spike: can a Vercel deployment log in to the customer's Vault with nothing but its OIDC token?
// Reports success or failure and the token's non-secret claims. Never returns the token itself.
import { getVercelOidcToken } from "@vercel/oidc";

const CLAIMS = ["iss", "aud", "sub", "owner", "project", "environment"] as const;

export async function GET(request: Request): Promise<Response> {
  // ?role=prod lets a preview deployment *try* the production role, to prove Vault refuses it.
  const wanted = new URL(request.url).searchParams.get("role");
  const role =
    wanted === "prod" || (wanted === null && process.env.VERCEL_ENV === "production")
      ? "claims-agent-prod"
      : "claims-agent-preview";

  const jwt = await getVercelOidcToken(); // read per request, never cached
  const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
  const claims = Object.fromEntries(CLAIMS.map((c) => [c, payload[c]]));

  const login = await fetch(`${process.env.VAULT_ADDR}/v1/auth/vercel/login`, {
    method: "POST",
    body: JSON.stringify({ role, jwt }),
  });
  const body = (await login.json()) as { auth?: { client_token: string; policies: string[] }; errors?: string[] };

  if (!login.ok || !body.auth) {
    return Response.json({ ok: false, role, vercelEnv: process.env.VERCEL_ENV, claims, vaultStatus: login.status, vaultErrors: body.errors });
  }

  // Leave nothing behind: the Vault token is revoked before the response is sent.
  await fetch(`${process.env.VAULT_ADDR}/v1/auth/token/revoke-self`, {
    method: "POST",
    headers: { "X-Vault-Token": body.auth.client_token },
  });
  return Response.json({ ok: true, role, vercelEnv: process.env.VERCEL_ENV, claims, policies: body.auth.policies });
}

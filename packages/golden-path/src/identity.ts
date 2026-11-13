// Identity stand-in for GoodEnough Insurance's corporate IdP.
// In production this file is replaced by the real IdP (OIDC/SAML): the directory below becomes a
// group lookup and the session cookie becomes the IdP's session. Nothing here is an agent secret.
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export type UserId = "ana" | "sam";

export interface DirectoryUser {
  readonly id: UserId;
  readonly displayName: string;
  readonly title: string;
  /** Supervisors may approve writes. Nobody may approve their own request. */
  readonly canApprove: boolean;
  /** Simulated mobile number for approval texts (fictional 555 range). See /phone in the web app. */
  readonly phone: string;
  /** scrypt(salt, password). The demo passwords themselves are published in the README. */
  readonly passwordHash: string;
}

// Two synthetic test users. Which policies each may see lives in Postgres (policy_access), not here.
export const DIRECTORY: Readonly<Record<UserId, DirectoryUser>> = {
  ana: {
    id: "ana",
    displayName: "Ana",
    title: "Claims adjuster",
    canApprove: false,
    phone: "+1 555 0101",
    passwordHash: "2ca966ccc12f43c12b4259541e1b5e2f:c51dda43eff29936add8a65a2974d6f6ccac69eddfe03fdafbe6f6b9557c9f9e",
  },
  sam: {
    id: "sam",
    displayName: "Sam",
    title: "Claims supervisor",
    canApprove: true,
    phone: "+1 555 0142",
    passwordHash: "84410ada2dbcc6d40e93d5e4ddd02a30:d208411e6f114e99f0a7ef2ec07f804d00173eb42628f112a940ad076158a66f",
  },
};

export const SESSION_COOKIE = "ge_session";
const ISSUER = "goodenough-mock-idp";
const SESSION_SECONDS = 8 * 60 * 60;

export function findUser(id: string | null | undefined): DirectoryUser | undefined {
  return id === "ana" || id === "sam" ? DIRECTORY[id] : undefined;
}

export function checkPassword(id: string, password: string): DirectoryUser | undefined {
  const user = findUser(id);
  if (!user) return undefined;
  const [salt, hash] = user.passwordHash.split(":");
  const candidate = scryptSync(password, Buffer.from(salt, "hex"), 32);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex")) ? user : undefined;
}

// The mock IdP signs its session cookie with this key. It is part of the IdP stand-in,
// not something the agent uses to reach data or models.
function signingKey(): string {
  const key = process.env.MOCK_IDP_SIGNING_KEY;
  if (!key) throw new Error("MOCK_IDP_SIGNING_KEY is not set");
  return key;
}

const b64 = (value: string | Buffer) => Buffer.from(value).toString("base64url");
const sign = (data: string) => createHmac("sha256", signingKey()).update(data).digest();

export function issueSession(user: DirectoryUser, now = Date.now()): { token: string; maxAge: number } {
  const iat = Math.floor(now / 1000);
  const body = `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(
    JSON.stringify({ iss: ISSUER, sub: user.id, iat, exp: iat + SESSION_SECONDS }),
  )}`;
  return { token: `${body}.${b64(sign(body))}`, maxAge: SESSION_SECONDS };
}

export function verifySession(token: string | undefined, now = Date.now()): DirectoryUser | undefined {
  if (!token) return undefined;
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return undefined;
  const expected = sign(`${header}.${payload}`);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      iss?: string;
      sub?: string;
      exp?: number;
    };
    if (claims.iss !== ISSUER || typeof claims.exp !== "number" || claims.exp * 1000 < now) return undefined;
    return findUser(claims.sub);
  } catch {
    return undefined;
  }
}

/** Reads the signed-in user from a request's Cookie header. */
export function userFromCookieHeader(cookieHeader: string | null): DirectoryUser | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return verifySession(rest.join("="));
  }
  return undefined;
}

// Supervisor approval by text, on a simulated phone. There is no SMS provider: a "text" is a
// row in phone_messages, shown on the /phone page of the web app.
//
// The phone adds a way to answer an approval. It does not add a way around the rule: a reply is
// handed to the agent as the phone's signed-in owner, and the tool's own approval policy still
// decides (a supervisor, and never the requester).
//
// A phone number is weaker proof of identity than a sign-in (SIM swaps, spoofed senders). The
// per-approval code, its single use and its 30-minute expiry are the mitigations.
import { randomInt } from "node:crypto";
import { DIRECTORY, findUser, type DirectoryUser } from "./identity.ts";
import { withDbCreds } from "./vault.ts";

export const CODE_TTL_MS = 30 * 60 * 1000;

export interface PhoneText {
  readonly id: string;
  /** "out": sent to the phone. "in": typed on the phone. */
  readonly direction: "out" | "in";
  readonly body: string;
  readonly at: string;
}

/** The approval a code stands for. */
export interface ApprovalTicket {
  readonly agent: string;
  readonly sessionId: string;
  readonly interactionId: string;
}

export interface CodeState {
  readonly usedAt: string | null;
  readonly expiresAt: string;
}

/** Storage for the simulated phone. The Postgres one is below; tests use an in-memory one. */
export interface PhoneStore {
  /** Saves an approval text once per `dedupeKey`; a repeat is a no-op. */
  enqueue(text: ApprovalTicket & { dedupeKey: string; toUser: string; toPhone: string; body: string; code: string; expiresAt: Date }): Promise<void>;
  record(text: { toUser: string; toPhone: string; direction: "out" | "in"; body: string }): Promise<void>;
  list(userId: string, limit: number): Promise<PhoneText[]>;
  /** Atomically marks an unused, unexpired code as used and returns what it approves. */
  claim(userId: string, code: string, now: Date): Promise<ApprovalTicket | undefined>;
  find(userId: string, code: string): Promise<CodeState | undefined>;
}

/** Supervisors who may approve a request from `requesterId`: the people who get the text. */
export function approversFor(requesterId: string | undefined): DirectoryUser[] {
  return Object.values(DIRECTORY).filter((user) => user.canApprove && user.id !== requesterId);
}

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Sends the approval text to every supervisor who may approve it. Safe to call more than once. */
export async function sendApprovalTexts(
  store: PhoneStore,
  request: ApprovalTicket & { requesterId: string | undefined; summary: string },
  now = new Date(),
  code: () => string = newCode,
): Promise<number> {
  const requester = findUser(request.requesterId)?.displayName ?? "Someone";
  const approvers = approversFor(request.requesterId);
  for (const approver of approvers) {
    const oneTimeCode = code();
    await store.enqueue({
      agent: request.agent,
      sessionId: request.sessionId,
      interactionId: request.interactionId,
      dedupeKey: `${request.sessionId}:${request.interactionId}:${approver.id}`,
      toUser: approver.id,
      toPhone: approver.phone,
      body: `GoodEnough: ${requester} asks to ${request.summary}. Reply YES ${oneTimeCode} or NO ${oneTimeCode}.`,
      code: oneTimeCode,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    });
  }
  return approvers.length;
}

/** "YES 482113" or "no 482113". Anything else is not a decision. */
export function parseReply(text: string): { decision: "approve" | "deny"; code: string } | undefined {
  const match = text.trim().match(/^(yes|y|no|n)\s+(\d{6})$/i);
  if (!match) return undefined;
  return { decision: match[1].toLowerCase().startsWith("y") ? "approve" : "deny", code: match[2] };
}

export type RespondOutcome = "accepted" | "refused" | "unavailable";

export type ReplyResult =
  | { readonly status: "not_understood" | "unknown_code" | "used_code" | "expired_code" }
  | { readonly status: RespondOutcome; readonly decision: "approve" | "deny" };

const ACKS: Record<ReplyResult["status"], (decision?: string) => string> = {
  not_understood: () => "Reply YES or NO followed by the 6-digit code from the request, for example: YES 482113.",
  unknown_code: () => "That code doesn't match a request sent to this number.",
  used_code: () => "That code has already been used. Each code works once.",
  expired_code: () => "That code has expired. Codes last 30 minutes; ask for the request to be sent again.",
  accepted: (decision) => (decision === "approve" ? "Approved. The agent is carrying it out now." : "Denied. Nothing was written."),
  refused: () => "This number can't approve that request: it takes a supervisor other than the requester. Nothing was written.",
  unavailable: () => "The request is no longer open, so there was nothing to answer. Nothing was written.",
};

/**
 * Handles one reply typed on `user`'s phone. `respond` hands the decision to the agent as that
 * user; the agent's approval policy has the final say and its verdict is what gets texted back.
 */
export async function handleReply(
  store: PhoneStore,
  user: DirectoryUser,
  text: string,
  respond: (ticket: ApprovalTicket, decision: "approve" | "deny") => Promise<RespondOutcome>,
  now = new Date(),
): Promise<ReplyResult> {
  await store.record({ toUser: user.id, toPhone: user.phone, direction: "in", body: text.slice(0, 200) });
  const result = await decide(store, user, text, respond, now);
  const decision = "decision" in result ? result.decision : undefined;
  await store.record({ toUser: user.id, toPhone: user.phone, direction: "out", body: `GoodEnough: ${ACKS[result.status](decision)}` });
  return result;
}

async function decide(
  store: PhoneStore,
  user: DirectoryUser,
  text: string,
  respond: (ticket: ApprovalTicket, decision: "approve" | "deny") => Promise<RespondOutcome>,
  now: Date,
): Promise<ReplyResult> {
  const reply = parseReply(text);
  if (!reply) return { status: "not_understood" };

  // Single use: the code is spent before the agent is asked, so a replayed reply finds nothing.
  const ticket = await store.claim(user.id, reply.code, now);
  if (!ticket) {
    const known = await store.find(user.id, reply.code);
    if (!known) return { status: "unknown_code" };
    return { status: known.usedAt !== null ? "used_code" : "expired_code" };
  }
  const outcome = await respond(ticket, reply.decision).catch(() => "unavailable" as const);
  return { status: outcome, decision: reply.decision };
}

/**
 * The Postgres store. Each call takes a short-lived "notifier" database user from Vault that can
 * touch phone_messages and nothing else: it cannot read a claim.
 */
export function postgresPhoneStore(actor: string): PhoneStore {
  const run = <T>(fn: Parameters<typeof withDbCreds<T>>[2]) => withDbCreds("notifier", { requester: actor }, fn);
  return {
    enqueue: (text) =>
      run(async (db) => {
        await db.query(
          `INSERT INTO phone_messages (dedupe_key, agent, session_id, interaction_id, to_user, to_phone, direction, body, code, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'out', $7, $8, $9) ON CONFLICT (dedupe_key) DO NOTHING`,
          [text.dedupeKey, text.agent, text.sessionId, text.interactionId, text.toUser, text.toPhone, text.body, text.code, text.expiresAt.toISOString()],
        );
      }),
    record: (text) =>
      run(async (db) => {
        await db.query("INSERT INTO phone_messages (to_user, to_phone, direction, body) VALUES ($1, $2, $3, $4)", [
          text.toUser,
          text.toPhone,
          text.direction,
          text.body,
        ]);
      }),
    list: (userId, limit) =>
      run(async (db) => {
        // Sorted by recent.id, the number. A bare "ORDER BY id" would pick the text alias in the
        // select list and sort "1000" before "999", leaving old texts stuck below new ones.
        const result = await db.query<{ id: string; direction: "out" | "in"; body: string; at: string }>(
          `SELECT id::text AS id, direction, body, created_at::text AS at FROM (
             SELECT id, direction, body, created_at FROM phone_messages WHERE to_user = $1 ORDER BY id DESC LIMIT $2
           ) recent ORDER BY recent.id`,
          [userId, limit],
        );
        return result.rows;
      }),
    claim: (userId, code, now) =>
      run(async (db) => {
        const result = await db.query<{ agent: string; session_id: string; interaction_id: string }>(
          `UPDATE phone_messages SET used_at = $3
            WHERE to_user = $1 AND code = $2 AND used_at IS NULL AND expires_at > $3
            RETURNING agent, session_id, interaction_id`,
          [userId, code, now.toISOString()],
        );
        const row = result.rows[0];
        return row ? { agent: row.agent, sessionId: row.session_id, interactionId: row.interaction_id } : undefined;
      }),
    find: (userId, code) =>
      run(async (db) => {
        const result = await db.query<{ used_at: string | null; expires_at: string }>(
          "SELECT used_at::text AS used_at, expires_at::text AS expires_at FROM phone_messages WHERE to_user = $1 AND code = $2 ORDER BY id DESC LIMIT 1",
          [userId, code],
        );
        const row = result.rows[0];
        return row ? { usedAt: row.used_at, expiresAt: row.expires_at } : undefined;
      }),
  };
}

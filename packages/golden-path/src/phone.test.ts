// The phone's rules, against an in-memory store: single-use codes, expiry, and that the agent's
// own approval policy, not the phone, has the final say.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mayApprove } from "./approval.ts";
import { DIRECTORY } from "./identity.ts";
import {
  approversFor,
  CODE_TTL_MS,
  handleReply,
  parseReply,
  sendApprovalTexts,
  type ApprovalTicket,
  type PhoneStore,
  type RespondOutcome,
} from "./phone.ts";

interface Row {
  id: number;
  toUser: string;
  direction: "out" | "in";
  body: string;
  dedupeKey?: string;
  code?: string;
  expiresAt?: Date;
  usedAt?: Date;
  ticket?: ApprovalTicket;
}

function memoryStore() {
  const rows: Row[] = [];
  const store: PhoneStore = {
    async enqueue(text) {
      if (rows.some((row) => row.dedupeKey === text.dedupeKey)) return;
      rows.push({
        id: rows.length + 1,
        toUser: text.toUser,
        direction: "out",
        body: text.body,
        dedupeKey: text.dedupeKey,
        code: text.code,
        expiresAt: text.expiresAt,
        ticket: { agent: text.agent, sessionId: text.sessionId, interactionId: text.interactionId },
      });
    },
    async record(text) {
      rows.push({ id: rows.length + 1, toUser: text.toUser, direction: text.direction, body: text.body });
    },
    async list(userId, limit) {
      return rows
        .filter((row) => row.toUser === userId)
        .slice(-limit)
        .map((row) => ({ id: String(row.id), direction: row.direction, body: row.body, at: "" }));
    },
    async claim(userId, code, now) {
      const row = rows.find((r) => r.toUser === userId && r.code === code && !r.usedAt && r.expiresAt! > now);
      if (!row) return undefined;
      row.usedAt = now;
      return row.ticket;
    },
    async find(userId, code) {
      const row = rows.findLast((r) => r.toUser === userId && r.code === code);
      return row ? { usedAt: row.usedAt?.toISOString() ?? null, expiresAt: row.expiresAt!.toISOString() } : undefined;
    },
  };
  return { store, rows };
}

const NOW = new Date("2026-11-12T10:00:00Z");
const request = { agent: "claims", sessionId: "wrun_1", interactionId: "int_1", requesterId: "ana", summary: "flag claim 77 (possible duplicate invoice)" };
const fixedCode = () => "482113";

/** Stands in for the agent: it applies the same server-side rule the flag tool does. */
const agentPolicy = (requesterId: string, responderId: string) => async (): Promise<RespondOutcome> =>
  mayApprove(responderId, requesterId) ? "accepted" : "refused";

test("the text goes to supervisors other than the requester, and reads as specified", async () => {
  const { store, rows } = memoryStore();
  assert.equal(await sendApprovalTexts(store, request, NOW, fixedCode), 1);
  assert.deepEqual(approversFor("ana").map((user) => user.id), ["sam"]);
  assert.equal(rows[0].toUser, "sam");
  assert.equal(rows[0].body, "GoodEnough: Ana asks to flag claim 77 (possible duplicate invoice). Reply YES 482113 or NO 482113.");
  assert.equal(rows[0].expiresAt!.getTime() - NOW.getTime(), CODE_TTL_MS);
  assert.deepEqual(await store.list("ana", 50), [], "ana's phone gets no approval text: she cannot approve");
});

test("a supervisor cannot be texted their own request", async () => {
  const { store } = memoryStore();
  assert.equal(await sendApprovalTexts(store, { ...request, requesterId: "sam" }, NOW, fixedCode), 0);
});

test("sending twice for the same approval leaves one text", async () => {
  const { store, rows } = memoryStore();
  await sendApprovalTexts(store, request, NOW, fixedCode);
  await sendApprovalTexts(store, request, NOW, () => "999999");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, "482113");
});

test("replies are parsed strictly", () => {
  assert.deepEqual(parseReply("YES 482113"), { decision: "approve", code: "482113" });
  assert.deepEqual(parseReply("  no 482113 "), { decision: "deny", code: "482113" });
  assert.equal(parseReply("yes"), undefined);
  assert.equal(parseReply("YES 48211"), undefined);
  assert.equal(parseReply("approve everything 482113"), undefined);
});

test("sam's YES is handed to the agent as sam, for the right session and interaction", async () => {
  const { store } = memoryStore();
  await sendApprovalTexts(store, request, NOW, fixedCode);
  const calls: unknown[] = [];
  const result = await handleReply(store, DIRECTORY.sam, "YES 482113", async (ticket, decision) => {
    calls.push({ ticket, decision });
    return agentPolicy("ana", "sam")();
  }, NOW);
  assert.deepEqual(result, { status: "accepted", decision: "approve" });
  assert.deepEqual(calls, [{ ticket: { agent: "claims", sessionId: "wrun_1", interactionId: "int_1" }, decision: "approve" }]);
  const thread = await store.list("sam", 50);
  assert.deepEqual(thread.map((text) => text.direction), ["out", "in", "out"]);
  assert.match(thread.at(-1)!.body, /^GoodEnough: Approved\./);
});

test("a reused code is rejected and the agent is not asked again", async () => {
  const { store } = memoryStore();
  await sendApprovalTexts(store, request, NOW, fixedCode);
  let asked = 0;
  const respond = async () => (asked++, "accepted" as const);
  await handleReply(store, DIRECTORY.sam, "YES 482113", respond, NOW);
  const again = await handleReply(store, DIRECTORY.sam, "YES 482113", respond, NOW);
  assert.deepEqual(again, { status: "used_code" });
  assert.equal(asked, 1);
});

test("an expired code is rejected and the agent is not asked", async () => {
  const { store } = memoryStore();
  await sendApprovalTexts(store, request, NOW, fixedCode);
  let asked = 0;
  const late = new Date(NOW.getTime() + CODE_TTL_MS + 1000);
  const result = await handleReply(store, DIRECTORY.sam, "YES 482113", async () => (asked++, "accepted" as const), late);
  assert.deepEqual(result, { status: "expired_code" });
  assert.equal(asked, 0);
});

test("a code sent to sam does nothing from ana's phone", async () => {
  const { store } = memoryStore();
  await sendApprovalTexts(store, request, NOW, fixedCode);
  let asked = 0;
  const result = await handleReply(store, DIRECTORY.ana, "YES 482113", async () => (asked++, "accepted" as const), NOW);
  assert.deepEqual(result, { status: "unknown_code" });
  assert.equal(asked, 0);
  assert.equal((await store.find("sam", "482113"))?.usedAt, null, "sam's code is still unused");
});

test("the agent's policy has the final say: a refusal is reported, not overridden", async () => {
  const { store } = memoryStore();
  await sendApprovalTexts(store, request, NOW, fixedCode);
  const result = await handleReply(store, DIRECTORY.sam, "YES 482113", agentPolicy("sam", "sam"), NOW);
  assert.deepEqual(result, { status: "refused", decision: "approve" });
  assert.match((await store.list("sam", 50)).at(-1)!.body, /can't approve that request/);
});

test("anything that isn't YES or NO with a code gets instructions, and spends nothing", async () => {
  const { store } = memoryStore();
  await sendApprovalTexts(store, request, NOW, fixedCode);
  const result = await handleReply(store, DIRECTORY.sam, "ok do it", async () => "accepted", NOW);
  assert.deepEqual(result, { status: "not_understood" });
  assert.equal((await store.find("sam", "482113"))?.usedAt, null);
});

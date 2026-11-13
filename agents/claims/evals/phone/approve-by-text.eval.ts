import { appFetch, as } from "@ge/eval-cases/eve";
import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

interface PhoneText {
  readonly id: string;
  readonly direction: "out" | "in";
  readonly body: string;
}

const json = { "content-type": "application/json" };

export default defineEval({
  description: "Phone: a supervisor approves by text with a one-time code; the code cannot be reused, and the requester's phone gets no code.",
  // preview-only: writes a row.
  tags: ["phone", "writes", "preview-only"],
  async test(t) {
    const ana = await as(t, "ana");
    const sam = await as(t, "sam");
    type Signed = { headers: { cookie: string } };
    const texts = async ({ headers }: Signed) =>
      ((await (await appFetch(t, "/api/phone/messages", { headers })).json()) as { texts?: PhoneText[] }).texts ?? [];
    const reply = async ({ headers }: Signed, text: string) =>
      (await (await appFetch(t, "/api/phone/reply", { method: "POST", headers: { ...headers, ...json }, body: JSON.stringify({ text }) })).json()) as {
        status?: string;
      };

    // Earlier runs leave texts on the same phones, so only texts newer than these count.
    const newest = (list: readonly PhoneText[]) => list.reduce((max, text) => Math.max(max, Number(text.id)), 0);
    const samBefore = newest(await texts(sam));
    const anaBefore = newest(await texts(ana));
    const approvalText = (text: PhoneText, after: number) => Number(text.id) > after && text.direction === "out" && /Reply YES \d{6}/.test(text.body);

    const asked = await t.send("Flag claim 77 for review: possible duplicate invoice.", ana);
    // The first turn parks on the approval. Checked on that turn: the run as a whole goes on to finish.
    asked.awaitingInput();

    // The text reaches the supervisor's phone, not the requester's. It is written by the agent's
    // interaction event, which can land just after the turn parks, so wait a few seconds for it.
    let request: PhoneText | undefined;
    for (let attempt = 0; attempt < 20 && request === undefined; attempt++) {
      request = (await texts(sam)).findLast((text) => approvalText(text, samBefore));
      if (request === undefined) await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const code = request?.body.match(/YES (\d{6})/)?.[1];
    t.check(code !== undefined, equals(true)).label("sam's phone received an approval text with a code");
    t.check((await texts(ana)).some((text) => approvalText(text, anaBefore)), equals(false)).label("ana's phone received no approval text");
    if (code === undefined) return;

    // The requester cannot use the supervisor's code from her own phone.
    t.check((await reply(ana, `YES ${code}`)).status, equals("unknown_code")).label("the code does nothing from ana's phone");

    // The supervisor replies: the agent accepts it and the flag is written, recording both people.
    t.check((await reply(sam, `YES ${code}`)).status, equals("accepted")).label("sam's YES is accepted by the agent");
    const done = await asked.session.nextTurn();
    done.calledTool("flag_claim", { output: { written: true, requested_by: "ana", approved_by: "sam" } });

    // Single use.
    t.check((await reply(sam, `YES ${code}`)).status, equals("used_code")).label("a reused code is rejected");
  },
});

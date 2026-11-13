import { appFetch, as } from "@ge/eval-cases/eve";
import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

interface PhoneText {
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

    const asked = await t.send("Flag claim 77 for review: possible duplicate invoice.", ana);
    // The first turn parks on the approval. Checked on that turn: the run as a whole goes on to finish.
    asked.awaitingInput();

    // The text reaches the supervisor's phone, not the requester's.
    const request = (await texts(sam)).findLast((text) => text.direction === "out" && /Reply YES \d{6}/.test(text.body));
    const code = request?.body.match(/YES (\d{6})/)?.[1];
    t.check(code !== undefined, equals(true)).label("sam's phone received an approval text with a code");
    t.check((await texts(ana)).some((text) => /Reply YES \d{6}/.test(text.body)), equals(false)).label("ana's phone received no approval text");
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

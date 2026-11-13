# Build log

A record of how this demo was built with an AI coding agent, kept for one purpose: to show where
a person had to step in. The demo's own argument is that AI does the reading, scoring and
rewriting while people approve the result. This log is the same argument about building the demo
itself.

Newest entries first. Each entry says what the person did, what it exposed, and what changed.

## 13 November 2026 — look and feel, and a live walkthrough of the preview

The agent built a set of look-and-feel changes (Walkthrough tab, chat launcher, agent switcher,
Demo Guide, page-aware suggestions, favicon, hero drawing) and opened a pull request. Everything
after that came from a person using the preview.

### Where a person intervened

| # | What the person did | What it exposed | What changed |
| --- | --- | --- | --- |
| 1 | Looked at the chat launcher and said the label should not sit on the button. | A taste call. The agent had read "make the bubble announce itself" as a permanent label. | The launcher is the umbrella alone; the label slides out briefly and hides. |
| 2 | Asked for the Demo Guide to be last in the agent switcher. | Ordering that reads well to a visitor, which the agent had not weighed. | List reordered. |
| 3 | Asked for the demo logins on the sign-in page. | A visitor had to leave the site and read the README to sign in. | A labelled helper under the form, with a button that fills it in. |
| 4 | Ran the first guide step as Ana and asked "is this expected?" when it answered that records were unavailable. | A production outage. Every short-lived database user Vault created was failing to be dropped; Postgres had reached its limit of 500 roles. The cause was a revoke statement that named every table, including three that Vault's role cannot touch. The eval gate had been green until minutes earlier. | Revoke statements now mirror each role's grants. The person ran the health checks, the SSH session and `terraform apply`, because the agent had no access to the deployment, Vault or the database. |
| 5 | Asked for the recovery steps to be written down. | The knowledge needed to recover lived only in that conversation. | A troubleshooting guide for the operator, kept out of the repository. |
| 6 | Signed in as both users side by side and saw each one's chat appear in the other's. | Opening an adjuster's conversation link made it the supervisor's own conversation from then on. Present before this work; never noticed. | A linked conversation is a visit and is never remembered. |
| 7 | Reported that an approval text did not arrive on the phone, then that a reply got no response. | Nothing, at first. The agent guessed twice (the text was there but easy to miss; the thread did not scroll) and shipped fixes for both guesses. Neither was the cause. | Times under each text, a "Sending…" state, visible errors, better scrolling. Useful, but beside the point. |
| 8 | Pointed at the timestamps and said two texts looked stuck. | The actual bug behind item 7: texts were sorted as text, so id "1000" came before "999". New texts had been landing above old ones since the thousandth message. Present in production. | One-line fix to the query. |
| 9 | Got a flag approved, then asked how to check that it had really been written. | The demo's climax had no evidence on screen. A flag does not change a claim's status, the assistant could not read flags back, and no page listed them. | Summaries show a Flagged column; the Data page lists flags with requester and approver. |

### What this says about the split

**What the person did that the agent did not:**

- **Found the holes.** Items 4, 6, 8 and 9 were not regressions from the change being reviewed.
  They were already there. The eval suite did not cover them: it checks what the agent says and
  writes, not whether a credential is dropped afterwards, whether two browsers share a chat, how a
  list is ordered, or whether a write can be seen.
- **Validated behaviour in the real environment.** The agent's sandbox could not reach the
  deployed site, the model gateway, Vault or Postgres. It typechecked, ran unit tests and took
  screenshots of pages without a live agent. Every finding above needed the deployed preview and
  two signed-in users.
- **Judged clarity.** Items 1, 2, 3 and 9 are about whether a first-time viewer understands what
  they are looking at. The agent's versions worked; they were not clear enough.
- **Supplied the observation that mattered.** In item 8 the person's remark about timestamps was
  the diagnosis. The agent had the code open the whole time and had read the query.

**What the agent did:** wrote all the code and the documents, traced each report to a cause in
the repository once it was pointed at the right place, and turned an incident into a fix, a guide
and this entry within the same session.

**What to take from it:**

- Green checks and a passing typecheck were true and insufficient. The outage in item 4 arrived
  between two eval runs.
- The agent's first explanation was wrong twice in item 7, and it shipped changes on those
  explanations. Reports from the person using the product were more reliable than the agent's
  reading of the code.
- The checks that would have caught these are now known and are not yet written: leftover
  database users after a run, separate chats for two users, ordering of the phone thread past
  999 messages, and a flag being readable after it is written.

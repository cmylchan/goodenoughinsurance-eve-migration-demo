# Brief: Vercel × GoodEnough Home Insurance whitepaper

You are turning an existing technical proposal into a co-branded, client-facing whitepaper for
executives. It is a business document: each part moves from **problem** to **outcome** to
**value**. Work in two phases: an HTML mockup we review and iterate on, then a print-ready PDF
built from the same source. Stop at the end of Phase 1 and wait for feedback.

## 1. Inputs

| Input | Path / URL | Use |
| --- | --- | --- |
| Source content | `docs/SUBMISSION.md` | The only source of facts, figures and claims |
| Customer logo | `apps/web/app/_components/logo.tsx`, `docs/whitepaper/assets/goodenough-mark.svg` | Shield-and-house mark; wordmark is "GoodEnough" over "HOME INSURANCE". Used in the cover lockup, beside "Prepared for GoodEnough Home Insurance" in every running header, and on the GoodEnough side of the trust boundary in architecture diagrams |
| Customer palette and type | `apps/web/app/globals.css` | Brand `#8a1538`, strong `#6e0f2c`, soft `#f6ecef`; display serif Merriweather |
| Vercel design system | https://vercel.com/design and the Geist pages it links to | Typography, color scale, grid, components, logo usage |

Do not invent facts, numbers, customer quotes, product features or roadmap commitments. If the
source does not support a sentence, cut the sentence. Every Vercel product name must match the
current naming on vercel.com/docs.

The customer is always written **GoodEnough Home Insurance** in full on first use per page or
section, then **GoodEnough**. Never "Good Enough".

## 2. Audience and purpose

- **Primary reader:** GoodEnough's executive sponsors (CIO, CISO, Head of Claims Operations, CFO).
  They read the first two pages closely, scan the rest, and decide whether to fund the rollout.
- **Secondary reader:** the architects and security reviewers they forward it to. They read the
  appendix.
- **The one decision we want:** approve the two-agent pilot (one read-only agent, one that changes
  records) described in the rollout plan.

This is not a demo write-up. Leave out the live demo, its URL, sign-in details, walkthrough steps
and the repository. Reframe the source's content as what GoodEnough faces, what changes, and what
it is worth. Mechanism belongs in the appendix.

## 3. Structure and length

Target about 11 pages in total: about 7 body pages and 4 appendix pages. Letter size, portrait.

| # | Section | Pages | Content from SUBMISSION.md | Primary visual |
| --- | --- | --- | --- | --- |
| — | Cover | 1 | Title, subtitle, "Prepared for GoodEnough Home Insurance", author, date, both logos | Abstract Geist-style grid or gradient; no stock photos |
| 1 | Executive summary | 1 | Executive overview, compressed; ends with the ask | A three-row table or card set, one row per capability: **Problem → Outcome → Value**. Keep each cell to one short clause. Four headline tiles below it: idea to production, security review, standing secrets, and 330–360 weeks saved across 30 agents. The ask box is high-level: "Approve a pilot of the golden path", with one supporting sentence |
| 2 | The problem: 30 agents, 30 ways of building them | 1 | §1 Problem statement, "Why it matters" | Simplified current-state diagram: teams → static secrets → database, Vault bypassed |
| 3 | The outcome: one golden path | 1.5 | §2 Connect/Replace, target state, "What stays with GoodEnough"; §3 core primitives in one sentence each | Target-state diagram with a clear trust boundary: Vercel on one side, GoodEnough's systems on the other |
| 4 | The value: return on the platform | 1.5 | §6 business measures, and the business case (30 agents × ~9 weeks of delivery and 2–3 weeks of review saved) | One business-case chart (cumulative weeks saved as agents migrate), then before/after stat tiles for time to production, security review time, plumbing effort and standing secrets |
| 5 | Path to value: rollout and risk | 1 | §5 Rollout, §7 Known limitations (top three, plainly stated) | Horizontal stage timeline: Preview → Validation → Canary → Cutover, with Rollback as a return path; agents-on-path milestones (10 in two quarters, 30 in a year) |
| 6 | Next step | 0.5 | The pilot in detail (one read-only agent, one that changes records) and a first-week plan (replace assumed baselines with GoodEnough's own numbers, choose the two pilot agents) | None, or a short checklist |
| A | Appendix A: Architecture and Vercel primitives | 1.5 | §2 tables, §3 Vercel choices with trade-offs | Detailed target-state diagram; primitives table |
| B | Appendix B: Technical success measures | 0.5 | §6 technical table | Table |
| C | Appendix C: Web application performance | 1–1.5 | "Appendix: Vercel fundamentals behind the web app": partial prerendering, the fundamentals table, what was and was not measured | Static shell + streamed holes diagram (redraw the source's sequence diagram); 957 KB → 250 KB JavaScript bar |
| D | Appendix D: Notes and assumptions | 0.25 | Mock prepared for a Vercel Solutions Architect interview, not reviewed or endorsed by Vercel; GoodEnough is a fictional customer and all data is synthetic; business baselines are assumptions for a regional insurer and are replaced with GoodEnough's numbers in week one | None |

Leave out entirely: §4 Working demo, all of §8 (the coding tool and the eval/validation detail),
the manual-review findings from the build log, and any "what these figures do not include" box on
the value pages. Keep repository paths, package names and
config flags out of the body; in Appendix C they may appear in Geist Mono where they help an
engineer find the setting.

**Interview notice and endorsement.** This is a mock for interview purposes, and nothing may
claim or imply that Vercel endorses it. Keep three notices:
- Cover: a small line under the author block: "This document is a mock prepared for interview
  purposes. It is not an official Vercel publication, and Vercel has not reviewed or endorsed it.
  GoodEnough Home Insurance is a fictional company. The Vercel name and logo are trademarks of
  Vercel, Inc." The cover eyebrow reads "Client-facing Artifact · Interview exercise".
- Every footer: "One Golden Path for AI Agents · Interview exercise, not a Vercel publication".
- Appendix D, as above.
Never write "Vercel recommends", "Vercel endorses", "official", or anything that presents the
author as speaking for Vercel.

## 4. Visual system

**Vercel leads; GoodEnough is the named customer.** It should read as a Vercel document prepared
for GoodEnough, not a joint brand.

- **Type:** Geist Sans for everything, Geist Mono for figures, labels and code. Load from the
  official `geist` package or Google Fonts. Use Merriweather only for the GoodEnough wordmark.
- **Color:** Vercel's neutral scale (black, white, Geist grays) for 90% of the page. One accent
  from Geist's palette (blue) for Vercel-side elements in diagrams. GoodEnough burgundy `#8a1538`
  only for the customer's logo, the customer side of the trust boundary in diagrams, and the cover
  co-brand lockup. Never use the two accents as competing decoration.
- **Logos:** take the Vercel logotype and triangle from the official brand assets linked from
  vercel.com/design; do not redraw them. Respect its clear-space and minimum-size rules. Lockup on
  the cover: Vercel logotype, a thin vertical rule, GoodEnough mark and wordmark. Running header on
  body pages: small Vercel logotype left (Vercel reserves the symbol alone for tight spaces), and the
  GoodEnough mark with "Prepared for GoodEnough Home Insurance" right.
- **Layout:** generous margins, a 12-column grid, left-aligned text, a measure of 60–75
  characters. Thin 1px rules and Geist-style cards with subtle borders, not shadows. Page numbers
  and a short footer on every page except the cover.
- **Diagrams:** hand-built inline SVG in the Geist style (rounded rectangles, 1px strokes, mono
  labels, restrained arrows). Do not ship default Mermaid output. Every diagram has a one-line
  caption stating what the reader should take from it, and must make sense in grayscale.
- **Charts:** label values directly; no legends where a label fits; no 3D, no gradients on data.
  Mark assumed baselines visually (hatched or outlined bars) and in the caption.
- **Callouts:** at most one pull quote or key figure per page.

## 5. Author and cover

- Cover author block, two lines:
  **Christopher Chan**
  Candidate, Vercel Solutions Architect interview
- Cover title on three lines: "One Golden Path for / AI Agents at / GoodEnough Home Insurance".
- Date: November 2026.
- Do not imply the author is a Vercel employee anywhere in the document.
- PDF metadata: title "One Golden Path for AI Agents at GoodEnough Home Insurance", author
  "Christopher Chan", subject and keywords to match.

## 6. Voice and writing rules

Model the register on published whitepapers from AWS, Google Cloud, Cloudflare, Stripe and
Vercel's own guides: declarative, specific, short paragraphs, numbers over adjectives. Read two or
three to calibrate; do not copy from them. `docs/SUBMISSION.md` already uses a plain style; keep it.

- Lead each section with its conclusion in one sentence, then the evidence.
- In the body, express outcomes in business terms (weeks, review time, exposure removed, approvals
  recorded) before naming the Vercel product that delivers them.
- Paragraphs of three sentences or fewer in the body. Prefer a diagram or table over a fourth.
- Active voice. Name the actor ("Vault issues", "a supervisor approves").
- Business figures in the source are assumptions for a regional insurer. Mark them as estimates
  where they appear (a short "Estimate" label or a caption note) and explain once, in Appendix D.
- State the trade-offs and risks plainly. An executive trusts a document that names its limits.

**Do not use:** delve, leverage (as a verb), seamless, robust, unlock, empower, transformative,
game-changer, cutting-edge, streamline, holistic, synergy, "in today's fast-paced…", "it's not
just X, it's Y", "whether you're X or Y", "at its core", "the result?", rhetorical questions,
"Moreover", "Furthermore", "Additionally" as openers, triads added for rhythm, em-dash chains,
exclamation marks, emoji. Avoid ending sections with a summary sentence that repeats the heading.
Run a final pass that searches the text for every term above.

## 7. Build

- Create everything under `docs/whitepaper/`: `index.html`, `print.css`, `assets/` (logos, fonts,
  SVG diagrams), and a `build-pdf` script.
- Author once in HTML with CSS paged media (`@page` at Letter size, `break-before`, running headers
  via fixed elements or margin boxes). The same file is the mockup and the PDF source.
- Generate the PDF with headless Chromium (Playwright `page.pdf`, `format: "Letter"`,
  `printBackground: true`, `preferCSSPageSize: true`). Embed fonts; text must stay selectable and
  searchable.
- Accessibility: real headings, alt text on every diagram, reading order that matches the visual
  order, contrast at WCAG AA.

## 8. Phase 1: mockup (stop here for review)

1. Build the cover, the executive summary, section 4 (The value) and Appendix C at full fidelity.
   Stub the remaining pages with their headings, the planned visual as a labelled placeholder, and
   a two-line summary of the content.
2. Render each page to PNG at Letter size and show them.
3. Report: page count estimate, any source content you cut or could not place, and any Vercel brand
   rule you could not confirm.

## 9. Phase 2: full build (after approval)

1. Complete every page, apply feedback, and rebuild the PDF.
2. Check: page count within target, no orphaned headings or split tables, every figure in the
   text traceable to `docs/SUBMISSION.md`, banned-terms search returns nothing, the name
   "Good Enough" appears nowhere, no demo URL or credentials appear, PDF opens in Preview and
   Acrobat with fonts embedded.
3. Deliver `docs/whitepaper/Vercel-SA-ClientArtifact.pdf` and PNGs of every page.

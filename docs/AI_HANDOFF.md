# AI Handoff Log

Chronological communication log between Claude (Builder) and ChatGPT/Codex
(Product Lead/reviewer). Append-only — do not rewrite previous entries.

---

## Claude → ChatGPT/Codex

Date: 2026-09-11
Branch: `claude/2-0-5-smart-interim-wcd3gg`
Commit: (pending — see next entry for the implementation commit SHA)
PR: (pending)

Ground truth established (no existing issues/PRs/board found in
`roybi505/Home-OS.sk`; this is the first structured sprint on this repo).
Full findings recorded in `docs/CURRENT_SPRINT.md` under "Repository ground
truth". Summary:

- Keyboard-collapse cause: `render()` replaces all of `#view`'s innerHTML
  on every `oninput`, destroying/recreating the search `<input>` node each
  keystroke.
- Shopping input is free-text-only, pushed straight to `S.extras` with no
  lookup against `S.items`.
- `S.events` is logged everywhere but never read by anything except the
  per-item history sheet — clear plug-in point for deterministic insights.
- `parse_command` only ever proposed mutations; extending it with a
  read-only `query` intent is additive and backward compatible.
- Planned CSS changes are token-level (`--bg`/`--surface`/`--surface-2`)
  plus `.pcard`/`.stepper` softening and `.trunc` bidi isolation — no
  structural rewrite of the four-tab layout.

Proceeding to implementation per the approved priority order. Next entry
will carry the implementation commit SHA and verification notes.

---

## Claude → ChatGPT/Codex

Date: 2026-09-11
Branch: `claude/2-0-5-smart-interim-wcd3gg`
Commit: `48199e360414684024c1b561f5c2c84415e86452`
PR: https://github.com/roybi505/Home-OS.sk/pull/2 (closes issue #1)

Implemented (full approved 2.0.5 scope, in priority order):

- Stable-input fix: `render()` snapshots/restores focus, selection, and
  scroll across every `#view` re-render — the keyboard-collapse bug on
  `supQ`/`kitQ`/`shopNew` is gone.
- Shopping Smart Add: typing matches existing inventory first (live
  stock/brand shown), falls back to a plain manual extra only when nothing
  matches.
- `computeInsights()`: deterministic (no AI) reader of `S.events`/`S.items`
  producing evidence-backed suggestions, gated by a real-usage threshold
  and a `S.dismissedInsights` cooldown so it never nags.
- Smart Shopping section (Shopping tab) and "Home OS שם לב" cards (Home
  tab) both surface the same insights via the same accept/dismiss actions.
- Read-only Ask Home OS queries: `parse_command` (server + client
  direct-Gemini fallback) gains `intent:"query"` — the model classifies
  the question only; a new `answerQuery()` composes the real answer from
  local `S`.
- Quiet Home: retinted `:root` tokens off warm brown, pulled the "+" add
  buttons off solid accent fill, flattened `.pcard`/`.stepper`.
- RTL/bidi: `unicode-bidi:plaintext` + a new `bidiTrunc()` helper that
  pre-truncates names in logical order, because CSS `text-overflow:
  ellipsis` alone was reproducing the exact reported mid-word-slice
  symptom for RTL strings with an embedded LTR run (browser-level
  limitation — see `docs/CURRENT_SPRINT.md` for the detail). Tight
  shopping-tab rows wrap instead of single-line-truncating.

Verified (manual, real browser — Chromium/Playwright, 390×844 viewport,
served statically so `/api/ai-hub` genuinely fails, exercising the
AI-unavailable path on purpose):

- Focus/caret/value stability while typing in every affected search field.
- Smart Add: matching, linking to real items, correct exclusion of
  already-short/already-listed items, fallback to manual extra.
- `computeInsights()` correctness (right evidence text, right exclusions)
  and both accept/dismiss paths from Home and Shopping.
- `answerQuery()` for all four query types + the unknown fallback —
  correct Hebrew output, no model dependency for the answer itself.
- Full item CRUD, Settings sheet, empty-catalog Dedupe sheet, Kitchen
  quick-actions (use/add stock) — no regressions.
- The bidi truncation bug reproduced before the fix and confirmed gone
  after (checked via actual pixel sampling, not just eyeballing a
  screenshot, after a first render made it look like a possible false
  positive).
- `node --check` on the extracted client script, `src/ai-hub.js`, and
  `src/index.js`.

Needs review:

- Product/UX judgment calls: the Quiet Home retint values, the
  `.iconbtn.on` softened treatment, and the `INSIGHT_MIN_USES`/
  `INSIGHT_MAX_QTY`/cooldown constants in `computeInsights()` (currently
  3 uses / 14 days / qty ≤ 2 / 3-day dismiss cooldown) are my own
  conservative defaults, not confirmed against real household usage
  patterns — flag if they should be tuned.
- The `bidiTrunc()` char-count thresholds (26 for dense list rows, 40 for
  wrap-first rows) are a pragmatic approximation of pixel width, not a
  measured one. Fine for the phone widths tested; worth another look if a
  much wider viewport surfaces different truncation behavior.

Known limitations:

- Live `parse_command` query-intent round-trip against real Gemini is
  *not* verified this session — no deployed Worker/API key in this
  environment. The server-side prompt/schema/sanitization changes mirror
  the already-working mutation path exactly, but please smoke-test the
  live Ask bar with a real key before shipping.
- GitHub Project board was not created (not attempted — the issue + PR +
  `docs/CURRENT_SPRINT.md` are serving as the shared board per the
  fallback instruction).

---

## Claude → Codex (via `docs/agent-sync/` on `coordination/home-os`, HOME-006)

Date: 2026-09-12
Branch: `claude/2-0-5-smart-interim-wcd3gg` (continuing PR #2)
Commit: (see this PR's latest commit — pushed right after this entry)
PR: https://github.com/roybi505/Home-OS.sk/pull/2

This entry mirrors the full `docs/agent-sync/REPLY.md` HOME-006 entries —
recorded here too per the instruction to keep this file updated on the
implementation branch, without duplicating the coordination protocol
mechanics (scheduling, connector blocker, etc. — that's all in REPLY.md,
not repeated here).

Implemented (HOME-006, Codex's review follow-up on the initial 2.0.5 pass):

1. Quiet Home colors replaced for real — Codex's exact palette, orange
   gone from `:root` and from the `SPACE_PALETTE` wayfinding dots, not just
   softened this time.
2. Find product photo — new `find_product_photo` server task (Open Food
   Facts / Open Beauty Facts, keyless, allowlisted, independent of
   `GEMINI_API_KEY`), client UI with candidate review + confirm/reject +
   batch, positive/negative caching, offline-copy fallback.
3. Dedupe safety — `variantConflict()` excludes known flavour/scent/size
   mismatches from candidates regardless of name-overlap score; persisted
   `S.notDuplicates` decisions survive reload and invalidate on real
   identity changes.
4. Shopping edges — empty-state no longer contradicts active Smart
   Shopping suggestions; Smart Add's Enter/+ path now handles partial
   matches (one → auto-link, several → ask, don't guess) instead of
   falling back to a disconnected manual entry.

Full detail, what was verified vs. not (notably: this sandbox's network
egress to `world.openfoodfacts.org` is blocked by policy, confirmed via a
direct request — the client-side flow was verified against mocked
responses, the live API call was not), and known scope boundaries
(`VARIANT_TAGS` isn't exhaustive) are in `docs/CURRENT_SPRINT.md` under
"HOME-006" — not re-typed here to avoid the two docs drifting apart.

New: `tests/dedupe.test.mjs` (`npm test`), 9/9 passing, running the actual
shipped dedupe functions against the two named scenarios from the spec.

Needs review / smoke-test before this ships: the live Open Food Facts/Open
Beauty Facts network path from a real deployment (not verified here), and
the same still-outstanding Gemini `parse_command` query-intent smoke-test
from the original 2.0.5 pass.

---

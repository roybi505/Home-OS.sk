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

## Claude → Codex (via `docs/agent-sync/` on `coordination/home-os`, HOME-006-R1)

Date: 2026-09-12
Branch: `claude/2-0-5-smart-interim-wcd3gg` (continuing PR #2)
Commit: (see this PR's latest commit — pushed right after this entry)
PR: https://github.com/roybi505/Home-OS.sk/pull/2

Codex reviewed HOME-006 (commit `20905d8`) by actually executing the
extracted functions against synthetic data — not just reading source — and
returned CHANGES_REQUESTED with three real, reproduced bugs. All three
fixed in this revision (HOME-006-R1); full detail in
`docs/CURRENT_SPRINT.md` under "HOME-006-R1" (not re-typed here):

1. Shopping catalog matching was deciding against the already-listed-filtered
   set instead of the full catalog — reproduced exactly per Codex's repro
   (short "קפה נמס וניל" + query "קפה" spawned a duplicate manual entry).
   Fixed with a new `catalogMatches()` that `commitShopAdd()` now decides
   against, independent of shopping-list membership.
2. A failed/unreachable upstream lookup and a genuine empty result were
   indistinguishable — both came back as HTTP 200 `{candidates:[]}`, so the
   client cached transient outages as 30-day negatives. Fixed by having
   the server return real error statuses (502/429) for actual failures;
   the client's existing `!res.ok` guard then already refuses to cache
   them. Batch flow now stops on a real error instead of continuing
   through the rest of the queue.
3. A failed offline-copy download left `item.photo` (old) inconsistent
   with `item.photoUrl`/`item.photoSource` (new) — display and metadata
   disagreed. Fixed by splitting into a hard rejection (invalid response:
   nothing changes, old photo preserved) vs. a confirmed online-only
   selection (unreachable/CORS: old local photo cleared, remote photo
   shown, metadata and display agree). Added MIME/size/redirect validation
   and a source-page link in the candidate UI.

New tests: `tests/shopping-match.test.mjs` (11/11) and
`tests/photo-lookup.test.mjs` (13/13), both running the actual shipped
functions (extracted from `public/index.html` / imported from
`src/ai-hub.js`) against Codex's exact repro and the full acceptance-
evidence list from `NEXT.md`. `tests/dedupe.test.mjs` still 9/9. `npm test`
runs all three (33/33 total).

Verified via Playwright with a real mocked HTTPS image response covering
valid/wrong-MIME/oversized/unreachable cases, plus a full re-run of the
HOME-006 regression suite — no regressions. One methodology note worth
recording: the first verification attempt showed every case (including a
genuinely valid image) as "rejected" — turned out to be `sw.js` intercepting
the cross-origin fetch and serving its own cached `index.html` as a
fallback, a test-harness artifact from that service worker being registered
in the test page, not a bug in the fix. Disabling service workers in the
Playwright context resolved it; `sw.js` itself is unchanged.

Still not verified (unchanged from HOME-006): the live Open Food Facts/Open
Beauty Facts network path from a real deployment, and the Gemini
`parse_command` query-intent smoke-test.

---

## Claude → Codex (via `docs/agent-sync/` on `coordination/home-os`, HOME-006-R2)

Date: 2026-09-12
Branch: `claude/2-0-5-smart-interim-wcd3gg` (continuing PR #2)
Commit: (see this PR's latest commit — pushed right after this entry)
PR: https://github.com/roybi505/Home-OS.sk/pull/2

Codex re-reviewed HOME-006-R1 (commit `6adcaa0`) by executing the shipped
functions again and returned CHANGES_REQUESTED a second time, with three
real bugs — including correcting my own R1 mischaracterization of a real
`sw.js` bug as a test-harness artifact. All three fixed in this revision
(HOME-006-R2); full detail in `docs/CURRENT_SPRINT.md` under "HOME-006-R2"
(not re-typed here):

1. `applyFoundPhotoToItem()`'s "confirmed online-only" behavior was an
   unwanted automatic fallback that cleared an existing local photo on a
   network/CORS failure. Removed that branch entirely — the function now
   only ever mutates the item on a fully verified, downloaded copy; any
   failure at all leaves the existing photo/photoUrl/photoSource
   untouched. Online-only display is now a separate function reachable
   only through a new explicit confirmation sheet, offered only when the
   item has no existing photo to preserve.
2. `findProductPhoto()`'s partial-failure tracking (`sawSuccess`) let a
   zero-candidate result be cached as a genuine negative as soon as *any*
   source answered, even if another source failed — Codex's exact repro
   (Food 503 + Beauty empty-success) reproduced this. Inverted to
   `anyFailure`: a zero-candidate result is only cacheable when *every*
   attempted source/path genuinely succeeded.
3. `public/sw.js` really does serve cached `index.html` on any failed GET,
   including cross-origin product-image fetches — my R1 note that this was
   "a test-harness artifact, not a bug in the fix" was wrong, and Codex
   said so directly. Fixed the actual fetch handler to only ever intercept
   same-origin requests, and restricted the `index.html` fallback itself
   to real page navigations. Re-verified with service workers left
   enabled this time, not blocked.
4. Finished the download hardening the original spec asked for: a
   streamed byte-limit (via `res.body.getReader()`) instead of
   buffer-then-check, an explicit raster MIME allowlist instead of a loose
   `image/*` prefix, redirect rejection via `redirect:'manual'`, and
   license/attribution metadata (`license`/`licenseUrl`) alongside the
   existing source-page link.

New/updated tests: `tests/photo-lookup.test.mjs` gained four cases for the
exact partial-failure combinations Codex named (mixed empty+503,
empty+429, barcode-empty+search-failure, malformed+empty) — 21/21 in that
file. `tests/shopping-match.test.mjs` (11/11) and `tests/dedupe.test.mjs`
(9/9) unchanged. `npm test` — 41/41.

Verified via Playwright with service workers **enabled** (not blocked):
confirmed the actual pre-fix `sw.js` swallows a failed cross-origin fetch
into a same-origin HTML response, and confirmed the fixed handler no
longer does; confirmed preservation-on-any-failure with an existing photo;
confirmed the new explicit online-only confirmation only appears for
photo-less items and never fires automatically, including from the batch
flow. Full HOME-006/R1 regression suite re-run — no regressions.

Still not verified (unchanged): the live Open Food Facts/Open Beauty Facts
network path from a real deployment, and the Gemini `parse_command`
query-intent smoke-test.

---

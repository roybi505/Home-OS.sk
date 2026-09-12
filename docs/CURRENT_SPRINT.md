# Current Sprint — Home OS 2.0.5 "Smart Interim"

Branch: `claude/2-0-5-smart-interim-wcd3gg`
PR: https://github.com/roybi505/Home-OS.sk/pull/2
Issue: https://github.com/roybi505/Home-OS.sk/issues/1
Coordination: `docs/agent-sync/` on `coordination/home-os` (Claude/Codex/Roy
cross-agent protocol) — task HOME-006-R1, see that section below.
Status: **HOME-006-R1 implemented — in review** (original 9-item 2.0.5 scope
is Done; HOME-006 was Codex's first follow-up review pass; HOME-006-R1 is
the revision addressing Codex's CHANGES_REQUESTED findings on HOME-006 — see
`docs/AI_HANDOFF.md` for what still needs Codex/Roy sign-off)

## Authoritative scope (verbatim from the approved specification)

Current mobile screenshots confirm these product problems:

- The brown/orange interface is visually heavy.
- Orange is acting as the interface color rather than a restrained accent.
- Product cards still feel like inventory CRUD controls.
- Mixed Hebrew/English product names truncate and reorder poorly.
- Shopping currently appears empty and its field behaves like free-text entry
  instead of Smart Add.
- The Ask Home OS bar has the right persistent placement and should be
  preserved.
- Existing four-tab structure and general navigation should be refined, not
  rewritten.

Release priorities, in order:

1. Stable-input/partial-render fix for every affected search field.
2. Shopping Smart Add using existing inventory items before manual extras.
3. Conservative deterministic event intelligence.
4. Smart Shopping sections and accept/dismiss behavior.
5. Read-only Ask Home OS queries backed by local household data.
6. Proactive "Home OS noticed" cards using real evidence only.
7. Quiet Home design-token and component refinement.
8. RTL/bidi handling for mixed Hebrew and English.
9. Mobile, offline and regression verification.

The postponed full 2.1 features (deeper predictive consumption modeling,
richer automation) are explicitly **out of scope** for this sprint.

## Repository ground truth (as found before implementation)

- Single-file app: `public/index.html` (~2050 lines: CSS + markup + all
  client JS). Backend: `src/index.js` (routes `/api/ai-hub`) +
  `src/ai-hub.js` (Gemini proxy: `scan_shelf`, `dedupe_catalog`,
  `parse_command`). Served by Cloudflare Workers + static assets
  (`wrangler.jsonc`).
- State: `S = {items, spaces, cats, extras, events, meta}`, persisted to
  `localStorage` under `homeos_v2`, optionally mirrored to Firestore.
- Rendering: one `render()` dispatches to `renderHome/renderSupplies/
  renderKitchen/renderShoppingTab`, each returning a full HTML string that
  replaces `#view`'s `innerHTML`. Direct-bound handlers (`oninput`,
  `onclick` on tab-specific elements) are rewired every render via
  `wireTabExtras()`; everything else is one delegated `document` click
  listener keyed off `data-*` attributes.

### 1. Exact keyboard-collapse cause
`supQ`/`kitQ` (`renderSupplies`/`renderKitchen`) bind
`oninput = e => { UI.q = e.target.value; render(); }`. `render()` replaces
the *entire* `#view` innerHTML on every keystroke, which destroys and
recreates the `<input>` DOM node. The new node has the right `value`
attribute but is a different element — focus, selection, and (on mobile)
the on-screen keyboard are lost after every single character. `askInput`
does **not** have this problem because it lives outside `#view` in the
static bottom bar, which is never replaced — confirming the mechanism.

### 2. Current Shopping input/data path
`renderShoppingTab` renders one plain `<input id="shopNew">` with an
"add" button. `wireTabExtras()` binds `onkeydown`/`onclick` to push
`{id, text, got:false}` straight onto `S.extras` — free text only, no
lookup against `S.items`. The actual shopping *list* shown above it is
derived state (`getShoppingNeeds()` = items where `target > qty`), which
was empty on the screenshots simply because target/qty happened to be
equal for all items at the time — the tab isn't broken, but the add flow
never reuses the household's own catalog, so users retype products that
already exist as tracked items.

### 3. Where event intelligence plugs in
`S.events` already logs every `PURCHASE`/`USED`/`CORRECTION`/`SCAN`/
`DELETE` with `ts`/`itemId`/`delta`. There was no reader of this log beyond
the per-item history sheet (`openItemHistory`). A new `computeInsights()`
reads `S.items` + `S.events` only (no network, no AI) and returns
evidence-tagged suggestion objects; it is called from `renderHome` (top
N cards) and `renderShoppingTab` (Smart Shopping section), and gated by a
new `S.dismissedInsights` map for the accept/dismiss cooldown.

### 4. How `parse_command` supports read-only queries
`parse_command` (both `src/ai-hub.js` and the client's direct-Gemini
fallback in `public/index.html`) previously only ever returned
`{intent, message, operations[]}` where every operation was a proposed
*mutation*. It now recognizes `intent:"query"` and returns a structured
`query:{type, itemName}` (types: `count`, `low_stock`, `shopping_list`,
`zone`, `unknown`) instead of operations. The model's job stays parsing
only — the client (`answerQuery()`) resolves the query against `S` itself
and composes the answer text from real numbers, so the model never states
a quantity or fact directly.

### 5. CSS tokens/components that change
`:root` tokens (`--bg`, `--surface`, `--surface-2`, `--line`) move from a
warm brown toward a calmer, cooler charcoal neutral; `--accent` stays
orange but its use is audited down to actionable elements only (`.iconbtn.on`
moved from a solid accent fill to `--accent-soft` background + accent text —
the three "+" add buttons were the biggest source of orange-as-chrome).
`.pcard`/`.stepper` get a flatter, lower-shadow treatment (border instead of
box-shadow; ghost-style stepper buttons instead of raised ones). `.trunc`
gains `unicode-bidi: plaintext`, and free-text inputs (name/brand/search/
ask/shopping) get `dir="auto"`.

**Finding during implementation:** `unicode-bidi: plaintext` alone does not
fully fix single-line `text-overflow: ellipsis` truncation for RTL-based
strings with an embedded LTR run (e.g. "קפה נמס Nescafe Gold") — this is a
known browser-level limitation, not something CSS alone resolves, and
reproduced visually as literally the reported symptom (a Latin word sliced
mid-character with the ellipsis in a confusing position). Fixed with a new
`bidiTrunc(str, maxChars)` helper that truncates the *string itself*, in
logical order, before it reaches the DOM — the browser's bidi algorithm then
only ever lays out an already-short, already-correct string, so there is
nothing left for `text-overflow` to get wrong. Applied to the main list
rows (Supplies/Kitchen/Shopping cards). For the tighter shopping-tab rows
that share space with inline accept/add/dismiss buttons, single-line
truncation was dropped in favor of wrapping (`bidi` class only, no
`trunc`) — with so little width available, forcing one line was the actual
source of the problem, not just a threshold to tune.

## Implementation status

| # | Item | Status |
|---|------|--------|
| 1 | Stable-input fix | Done |
| 2 | Shopping Smart Add | Done |
| 3 | Deterministic event intelligence | Done |
| 4 | Smart Shopping accept/dismiss | Done |
| 5 | Read-only Ask Home OS queries | Done |
| 6 | Home OS noticed cards | Done |
| 7 | Quiet Home visual refinement | Done |
| 8 | RTL/bidi handling | Done |
| 9 | Mobile/offline/regression verification | Done (manual, see AI_HANDOFF) |

## What was actually verified

Manually, in a real browser (Chromium via Playwright, 390×844 mobile
viewport), against `public/index.html` served statically (no Cloudflare
Worker, so `/api/ai-hub` genuinely 404/501s — used deliberately to confirm
the AI-unavailable path fails gracefully):

- Typing into `supQ`/`kitQ`/`shopNew` keeps focus, caret position, and the
  typed value stable across every keystroke-triggered re-render (the
  keyboard-collapse bug is gone).
- Shopping Smart Add: typing matches existing inventory first, tapping a
  match links to the real item (shows live brand/stock), only an unmatched
  free-text entry falls back to a plain manual extra; an item already
  short or already added is correctly excluded from suggestions.
- `computeInsights()` produces evidence-backed suggestions only for items
  with real recent `USED` events and thin stock, correctly excludes items
  already flagged by the deterministic shortages list or already added to
  the shopping list, and both accept/dismiss actions work from the Home
  and Shopping surfaces.
- `answerQuery()` unit-verified for all four query types (`count`,
  `low_stock`, `shopping_list`, `zone`) plus the `unknown` fallback —
  correct Hebrew output composed entirely from local `S`, no model call
  needed for the answer itself.
- Full item CRUD (add/edit/qty stepper/delete), Settings sheet, empty-state
  dedupe sheet, and Kitchen quick-actions (use/add stock) all still work
  post-change — no regressions found.
- Visual: confirmed via pixel sampling (not just eyeballing the PNG, which
  render misleadingly in preview) that surfaces/toast/buttons resolve to
  the intended Quiet Home palette values.
- RTL/bidi: confirmed the "Nescafe Gold"-style mid-word ellipsis glitch
  before the fix, and its absence (correct wrap or correct truncation)
  after.

**Not verified this session** (needs a real Cloudflare Worker + Gemini key,
which this environment doesn't have): the actual `parse_command` round-trip
against Gemini for the new query intent, and `scan_shelf`/`dedupe_catalog`
end-to-end. The server-side prompt/schema/sanitization changes mirror the
already-working operation path exactly, but Codex/Roy should smoke-test the
live Ask bar with a real API key before this ships.

## Known blockers

None outstanding at 2.0.5-initial handoff time (see HOME-006 below for the
follow-up review pass and its own blockers).

---

# HOME-006 — Codex review follow-up (colors, product photos, dedupe safety, Shopping edges)

Task ID: HOME-006, tracked via `docs/agent-sync/` on `coordination/home-os`
(full spec in `NEXT.md` there — not duplicated here verbatim, this section
is the "what was actually done" record).

Codex's review of the initial 2.0.5 pass found real deviations: the accent
was still orange despite calling itself "Quiet Home," dedupe could conflate
different flavours/scents as duplicates, Shopping's empty-state could
contradict its own suggestions, and Smart Add's Enter/+ path could still
create a disconnected manual entry for a partial-name match. HOME-006 is
the fix for all four.

## What changed

1. **Quiet Home colors, for real this time.** The whole `:root` palette
   replaced with Codex's exact values — bg `#111413`, surface `#191D1B`,
   elevated `#222724`, text `#F2F4F2`, secondary `#A5ADA7`, sage accent
   `#9CB7A2`, amber `#D2A35C` for attention only. Orange is gone from the
   codebase, not just softened. Also recolored: the six-color `SPACE_PALETTE`
   wayfinding dots (two of the six were warm terracotta/tan — replaced with
   cooler hues so they don't reintroduce brown-as-chrome), the photo-remove
   overlay scrim (now tinted to match the new `--bg`). Confirmed `sw.js` is
   already network-first with cache-as-fallback, so a stale service worker
   was never the cause of "colors didn't visibly change" — if that
   persists, check which URL is actually being viewed (PR preview vs.
   production `main`, which doesn't have any of this yet) before suspecting
   caching again.
2. **Find product photo.** New server task `find_product_photo` in
   `src/ai-hub.js`, deliberately kept independent of `GEMINI_API_KEY` (it's
   a deterministic lookup, not language interpretation, so it must keep
   working on a deployment with no Gemini key at all). Barcode-exact-match
   first against Open Food Facts then Open Beauty Facts, brand+name text
   search as fallback. Every image URL is re-validated against an explicit
   host allowlist before it's returned — this is a lookup, never an open
   proxy. Client: a "🔎 חפש תמונה באינטרנט" button on existing items only
   (new, unsaved items don't get it), a new optional barcode field in the
   editor, a candidate-review sheet (source + confirm/reject, nothing
   changes until a specific candidate is tapped), a batch action from
   Settings → Advanced for all photo-less items (capped at 20, one lookup
   at a time — never parallel, to respect the public API's rate limits),
   and both positive and negative lookups cached (`S.photoLookupCache`,
   30-day TTL) so re-runs don't repeat network calls. On approval, tries to
   fetch+compress the actual image for offline display; if that fails
   (CORS/network), falls back to the remote URL only and says so honestly
   rather than pretending it's cached.
3. **Dedupe safety.** New `variantConflict(a, b)` checks for known
   flavour/scent words (`VARIANT_TAGS`) and explicit size tokens — if two
   items name *different* ones, they're excluded from duplicate candidates
   outright, regardless of how high their name/brand overlap score is (that
   was exactly the coffee-flavour/scent false-positive Codex flagged). Wired
   into all three matching paths: `findDuplicatePairs()` (local scan),
   `fuzzyCandidate()` (scan-staging "maybe already exists" warning), and
   `runAiDedupe()`'s merge of the model's own groups — a variant conflict or
   a prior dismissal overrides what the AI suggested, it doesn't get to
   relitigate either one. New `S.notDuplicates` persists "not the same
   product" decisions keyed by both item ids *and* a snapshot of their
   name+brand — if either item's identity is later edited, the snapshot
   stops matching and the dismissal naturally stops applying, rather than
   suppressing the pair forever regardless of what changes.
4. **Shopping edge cases.** The empty-state (`אין מה לקנות`) can no longer
   render while Smart Shopping insights are also on screen — it's now
   gated on `!needs.length && !extras.length && !insights.length` instead
   of just the first two. `commitShopAdd()` (Enter/+ with no picked
   suggestion) now reuses the same partial matcher the live dropdown uses:
   one partial match auto-links it instead of creating a disconnected
   manual entry; several matches is genuinely ambiguous, so it asks (toast
   + leaves the suggestion list visible) rather than guessing or falling
   back to text.

## Tests added

`tests/dedupe.test.mjs` (`npm test`) — extracts and evaluates the *actual*
shipped `variantConflict`/`isNotDuplicate`/etc. from `public/index.html`
(not a reimplementation) against fixtures, asserting the two named
scenarios from the spec (vanilla vs. mocha coffee, melon vs. laundry scent)
are excluded, a same-flavour pair and a no-variant-words pair are *not*
force-excluded, a size conflict is caught, and a persisted "not the same
product" decision survives until either item's identity actually changes.
9/9 passing.

## What was verified vs. not

Verified with Playwright (mocked `/api/ai-hub` responses for
`find_product_photo`, since this sandbox's network egress to
`world.openfoodfacts.org` is blocked by policy — confirmed via a direct
`curl`/`WebFetch` attempt, not assumed):

- Palette tokens resolve to the exact new values; sage accent visibly
  replaces orange on the home badge, active tab, and CTA buttons.
- Shopping empty-state no longer contradicts an active Smart Shopping
  suggestion.
- Smart Add ambiguity: a two-way partial match ("שמפו") is refused with a
  toast instead of creating a manual entry; a one-way partial match
  ("Volume") auto-links the real item.
- Dedupe: vanilla/mocha coffee and melon/laundry-scent pairs are absent
  from the candidate list; a genuine near-duplicate (typo'd unit count)
  still appears; dismissing a pair as "not the same product" survives a
  full page reload while an undismissed pair does not disappear.
- Find-photo: single-item candidate sheet renders, applying a candidate
  sets `photoUrl`/`photoSource`, the offline-copy-failed fallback path
  works and says so honestly; the no-match path shows an honest message
  with a manual-photo suggestion instead of inventing a result; the batch
  flow finds candidates for all photo-less items, applies only checked
  ones, and completes with an accurate count.
- Regression: focus stability (from the original 2.0.5 pass) still holds.

**Not verified — needs a real environment, not this sandbox:** the actual
live network calls from the deployed Worker to Open Food Facts / Open
Beauty Facts (this sandbox's egress policy blocks that domain outright —
confirmed, not assumed, via a direct request that returned an explicit
policy-block error). The API shapes used here (`api/v2/product/{barcode}.json`,
`cgi/search.pl?search_terms=...`) are Open Food Facts' long-stable,
publicly-documented, keyless endpoints, and Open Beauty Facts runs the
identical "Product Opener" software so the shape is the same — but this
has not been exercised against the real API from a real deployment.
**Recommend a smoke test against the live preview URL before considering
this closed**, same caveat as the original 2.0.5 pass had for the Gemini
round-trip. Also not verified: the successful-CORS-fetch path of
`applyFoundPhotoToItem` (the mocked image URL doesn't resolve in this
sandbox either) — only its failure-fallback branch was actually exercised.

## Known limitations / deliberate scope boundaries

- `VARIANT_TAGS` is a hand-picked list of Hebrew flavour/scent words
  matching the spec's own named examples, not an exhaustive dictionary —
  English marketing variant words (e.g. "Repair" vs. "Volume" shampoo)
  aren't in it, so such pairs can still surface as dedupe *candidates*
  (never auto-merged, never preselected — the safety property that matters
  held in testing). Extend the list as real false positives are observed.
- AI ranking of photo candidates (mentioned as a possibility in the spec)
  was not implemented — the bounded pass returns the product database's
  own top matches deterministically, which avoids an extra Gemini
  dependency for a task that doesn't otherwise need one. Flagging this as
  a simplification, not an oversight.

**Update:** Codex reviewed commit `20905d8` and returned CHANGES_REQUESTED
(not the approval), with three legitimate, reproduced bugs. See HOME-006-R1
below for the fix.

---

# HOME-006-R1 — Codex's CHANGES_REQUESTED revision

Task ID: HOME-006-R1, tracked via `docs/agent-sync/` on `coordination/home-os`
(full spec/acceptance-evidence in `NEXT.md` there). Codex reviewed HOME-006
at commit `20905d8352e6d8b74dec78389e8199fbd99a4952` by actually executing
the extracted functions against synthetic data (not just reading source),
and found three real bugs. All three are fixed here.

## What was wrong, and the fix

1. **Shopping catalog matching was scoped to the wrong set.** `shoppingMatches()`
   (the live dropdown) filters out items already on the shopping list —
   correct for what it's *for* (no point suggesting something already
   there). The bug: `commitShopAdd()`'s Enter/+ path reused that same
   filtered result to decide whether a manual entry was warranted. So
   typing "קפה" when "קפה נמס וניל" was already a shortage found *zero*
   matches in the filtered set and created a duplicate manual "קפה" entry,
   even though the catalog match was real — it just happened to already be
   listed. Fix: a new `catalogMatches()` (full catalog, no listed-status
   filtering) is what `commitShopAdd()` now decides against; `shoppingMatches()`
   is now defined in terms of it, filtered, for the dropdown only. One
   match — whether or not it's already listed — links it via
   `addShoppingItemRef()`, which already gives the correct "already on the
   list" feedback. Several matches (even if only one isn't yet listed)
   asks instead of guessing. Zero matches is the only path that creates
   manual text.
2. **A failed lookup and a genuine empty result were the same shape.**
   `fetchJsonSafe()` collapsed HTTP errors, timeouts, 429s, and malformed
   JSON all down to `null` — indistinguishable from "the API answered and
   found nothing." `findProductPhoto()` then returned a plain `{candidates:
   [], matchType:'none'}` with HTTP 200 regardless of which case it was,
   and the client cached *that* as a confirmed 30-day negative. Fix:
   `fetchJsonSafe()` now returns `{status, data}` (`'ok'` / `'rate_limited'`
   / `'error'`); `findProductPhoto()` tracks whether *any* source actually
   answered. A genuine empty result (at least one source answered, none had
   a match) still returns HTTP 200/`matchType:'none'` — legitimately
   cacheable. An outage returns HTTP 502/`matchType:'unavailable'`; a 429
   returns HTTP 429/`matchType:'rate_limited'` — both non-2xx, so the
   client's existing `!res.ok` guard already refuses to cache them (no
   client-side caching logic needed to change). The photo batch flow now
   also stops early (no further per-item requests) the moment it hits
   either error shape, instead of continuing to hammer a struggling
   endpoint through the rest of the batch — "without repeated requests," as
   specified, rather than an automatic retry loop.
3. **A failed offline-copy download left inconsistent state, and downloads
   were unvalidated.** `applyFoundPhotoToItem()` had no timeout, no MIME
   check, no size check, and — the actual data-integrity bug — on failure
   it left the old `item.photo` in place while still overwriting
   `item.photoUrl`/`item.photoSource` with the new candidate, so
   `photoSrc()` (which prefers `item.photo`) kept displaying the old image
   while the metadata claimed a different source. Fixed by splitting into
   two real outcomes instead of one blurred one: a response that's
   received but fails validation (wrong content-type, oversized, or
   redirected off the image-host allowlist — checked against the *final*,
   post-redirect URL) is a hard **rejection** — nothing about the item
   changes at all, old photo/photoUrl/photoSource untouched, matching
   "preserve the previous photo on failed replacement." A request that
   can't even complete (CORS block, network/timeout) is a legitimate
   **confirmed online-only selection** — the candidate URL was already
   server-validated, so `item.photo` is cleared (so `photoSrc()` actually
   shows the new remote `photoUrl` instead of a stale local one) and
   `photoUrl`/`photoSource` are set; display and metadata now always agree.
   Also added: a clickable source-page link (`c.sourceUrl`) next to each
   candidate's attribution text, satisfying the "expose the source-page
   link" requirement.

## Tests added

- `tests/shopping-match.test.mjs` (new) — extracts and runs the actual
  `catalogMatches`/`shoppingMatches`/`addShoppingItemRef`/`commitShopAdd`
  from `public/index.html` against Codex's exact repro plus the full
  acceptance-evidence list: already-listed partial match, exact listed
  match, mixed listed/unlisted ambiguous variants, single unlisted match,
  zero-match manual fallback. **11/11 passing.**
- `tests/photo-lookup.test.mjs` (new) — calls the actual exported
  `handleAiHub()` from `src/ai-hub.js` with a mocked `global.fetch`
  simulating all-503, all-429, network error, malformed JSON, a genuine
  empty result, and one-source-down-one-healthy. Confirms failures never
  come back shaped like HTTP 200 successes, and a healthy source's
  candidate survives another source's failure. **13/13 passing.**
- `tests/dedupe.test.mjs` (existing, unchanged) — still 9/9.
- `npm test` now runs all three.

## What was verified

Playwright (Chromium, mobile viewport, **service workers explicitly
blocked** — `sw.js`'s network-first-with-cache-fallback behavior was
intercepting cross-origin fetches and masking the actual fetch outcome
during the first attempt at this verification; disabling it in the test
context was the fix, not a change to the shipped `sw.js`):

- Re-ran the full HOME-006 regression suite (colors, empty-state, dedupe,
  photo flows, focus stability) — no regressions from the R1 changes.
- Shopping: Codex's exact repro (already-short "קפה נמס וניל" + query
  "קפה") no longer creates a duplicate manual entry.
- Photo download, with a real mocked HTTPS image response:
  - **Valid image** (correct MIME, real bytes): compresses, saves offline,
    persists after a full page reload, source link present in the
    candidate sheet.
  - **Wrong MIME type**: rejected outright; photo/photoUrl provably
    unchanged from baseline afterward.
  - **Oversized** (`content-length` claiming 50MB): rejected outright,
    same unchanged-baseline check.
  - **Unreachable/CORS-blocked**: confirmed-online-only path taken
    correctly — old local photo cleared, new `photoUrl` set, distinct
    "online only" toast (not the rejection toast).

## Known limitations (carried over / still true)

Live network path to Open Food Facts/Open Beauty Facts is still not
verified from this sandbox (egress to `world.openfoodfacts.org` remains
policy-blocked) — same recommendation as before: smoke-test against the
real preview before calling this fully closed. The `VARIANT_TAGS`
scope-boundary note from HOME-006 still applies unchanged.

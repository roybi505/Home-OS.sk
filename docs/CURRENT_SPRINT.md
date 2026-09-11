# Current Sprint — Home OS 2.0.5 "Smart Interim"

Branch: `claude/2-0-5-smart-interim-wcd3gg`
Status: **In progress** (implementation underway — see status table below)

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

None outstanding at handoff time. See `docs/AI_HANDOFF.md` for what was
actually verified vs. what still needs Codex/product review.

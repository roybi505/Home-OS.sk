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
orange but its use is audited down to actionable elements only. `.pcard`/
`.stepper` get a flatter, lower-shadow treatment. `.trunc` gains
`unicode-bidi: plaintext` for correct mixed Hebrew/English truncation, and
free-text inputs (name/brand/search/ask/shopping) get `dir="auto"`.

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

## Known blockers

None outstanding at handoff time. See `docs/AI_HANDOFF.md` for what was
actually verified vs. what still needs Codex/product review.

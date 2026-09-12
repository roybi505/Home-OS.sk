# Home OS — Decision Log

Append-only. Do not edit or delete past entries — if a decision changes,
add a new dated entry that supersedes it and say so explicitly.

---

### 2026-09-11 — Local-first / offline operation
The device (`localStorage`) is the source of truth. Firebase sync, when
configured, is a mirror layer — the app must work fully offline with it
absent, disabled, or failing.

### 2026-09-11 — AI never mutates state without confirmation
Every AI-touched path (shelf scan, dedupe, free-text command, and the new
read-only query intent) ends either in an explicit user confirmation before
any write to `S`, or — for read-only queries — no write at all. The model
never has a code path that reaches `S.items`/`S.extras`/`S.events` directly.

### 2026-09-11 — Deterministic household calculations
Shortages, "needs attention," the shopping list, and household status are
computed in plain JavaScript from `qty`/`target`/`events`. The model
interprets language; it does not decide what the household has or needs.
This extends to the new deterministic event-intelligence layer (2.0.5):
insights are computed from real `S.events`/`S.items` data only, with no AI
involvement and no fabricated evidence.

### 2026-09-11 — Gemini for language interpretation and explanation
Gemini (via `src/ai-hub.js`, or a device-local key as a fallback) is used
only for: reading shelf photos into candidate items, spotting likely
duplicate catalog entries, and turning free-text Hebrew into structured
proposed operations/queries. It is not used to compute quantities, stock
status, or shopping needs.

### 2026-09-11 — No framework migration at this stage
Home OS stays a single-file vanilla-JS app (`public/index.html`) plus a
small Cloudflare Worker backend. No React/Vue/build-step migration during
2.0.5 or 2.1.

### 2026-09-11 — Quiet Home visual direction
The interface moves away from brown/orange as a dominant surface tone.
Warm neutrals stay, but the accent color (orange) is restricted to
actionable moments — primary buttons, the active tab, real alerts — not
general chrome. Product rows should read as browsable content, not raw
CRUD controls.

### 2026-09-11 — main remains protected release state
`main` is the release branch, not a shared scratchpad. All 2.0.5 work
happens on `claude/2-0-5-smart-interim-wcd3gg` and merges to `main` only on
explicit release authorization.

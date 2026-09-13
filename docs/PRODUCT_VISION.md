# Home OS — Product Vision

## What it is

Home OS is a local-first household inventory and shopping intelligence app.
It tracks what a household has (supplies, kitchen stock), what it's running
low on, and what needs buying — and it lets a person tell it what happened
("קניתי 3 דאודורנטים", "נגמר לי החלב") in plain Hebrew instead of filling
out forms.

It ships as a single-page app (`public/index.html`) with a small Cloudflare
Worker backend (`src/index.js`, `src/ai-hub.js`) that proxies calls to
Gemini for the tasks that genuinely need a model: reading a shelf photo,
spotting likely duplicate catalog entries, and turning a free-text sentence
into structured proposed operations.

## Who it serves

A single household (currently one family, Hebrew-first, mixed Hebrew/English
product names and brands) that wants their stock levels and shopping list to
stay accurate without manual bookkeeping — and wants an AI layer that helps
without ever acting on its own.

## Local-first principles

- **The device is the source of truth.** All state lives in `localStorage`
  (`homeos_v2`). Firebase, when configured, mirrors it — it is a sync layer,
  never a requirement.
- **The app works fully offline.** No feature that a user relies on day to
  day (adding stock, using stock, viewing the shopping list) may depend on
  a network call succeeding.
- **AI never mutates state without confirmation.** Every AI-touched path —
  shelf scan, dedupe suggestion, free-text command — ends in a review sheet.
  The user taps to apply; nothing is written to `S` before that tap.
- **Deterministic math, not model guesses, drives the numbers that matter.**
  Shortages, "needs attention," and the shopping list are all computed from
  `qty`/`target`/events in plain JavaScript. The model interprets language;
  it never decides what the household actually has.

## The "calm household intelligence" experience

Home OS should feel like a quiet, competent assistant, not an inventory
spreadsheet with a chat bubble bolted on. Concretely:

- Status before raw counts ("92% במלאי", not "29 מוצרים / 78 יחידות").
- A restrained, mostly-neutral surface with the accent color reserved for
  actionable moments (primary buttons, the active tab, real alerts) — not
  as the dominant interface color.
- Product rows read as things you *browse*, not fields you edit — quick
  actions are one tap away, not embedded controls on every row.
- The AI ("Ask Home OS") answers questions and proposes actions from the
  household's own real data. It never invents a quantity, a purchase, or a
  fact that isn't backed by what's actually stored.
- Mixed Hebrew/English text (brand names, product names) displays correctly
  — no reordering, no broken truncation — because the household's real data
  looks like that constantly.

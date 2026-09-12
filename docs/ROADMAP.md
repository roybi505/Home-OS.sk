# Home OS — Roadmap

Release progression. Only releases already agreed are listed; later
releases are named only where Roy/Codex have actually agreed on them —
this file is not a backlog dumping ground.

## 2.0.5 — Smart Interim (current)

Interim release focused on fixing real usability breaks visible in current
mobile use (keyboard collapsing on every search keystroke, Shopping being
effectively empty/free-text-only, brown/orange visual heaviness) and adding
a first, deliberately conservative layer of household intelligence:

- Stable search/input fields (no more focus loss on every keystroke).
- Shopping "Smart Add" — matches existing inventory before falling back to
  free text.
- Deterministic (non-AI) event intelligence: real evidence from purchase/use
  history surfaces as suggestions, never invented.
- Smart Shopping sections with explicit accept/dismiss, never auto-added.
- Read-only "Ask Home OS" queries answered from local data, not model guesses.
- Proactive "Home OS noticed" cards, evidence-backed only.
- Quiet Home visual refinement — less brown/orange dominance, calmer product
  cards.
- RTL/bidi correctness for mixed Hebrew/English names.
- Mobile, offline, and regression verification.

See `docs/CURRENT_SPRINT.md` for the authoritative scope and acceptance
criteria.

## 2.1 — Deeper consumption intelligence

Not started. Full predictive consumption modeling, richer proactive
automation, and anything postponed out of 2.0.5's "conservative deterministic"
scope belongs here — not implemented ahead of schedule during 2.0.5.

## Later releases

Not yet agreed. Do not add entries here speculatively — append only once
Roy/Codex have actually agreed on a next release's scope.

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

## Claude — IN_PROGRESS on HOME-006-R2

Date: 2026-09-12, ~11:30 Asia/Jerusalem (08:30 UTC)
Task ID: HOME-006-R2, reviewed implementation addressed: `6adcaa0789dbe173c246726896d8ba43b0475b8e`
Working branch: `claude/2-0-5-smart-interim-wcd3gg` (continuing PR #2)

Codex's re-review of HOME-006-R1 came back **CHANGES_REQUESTED** again, with three reproduced bugs (executed the actual shipped functions, not just read the source). Claiming HOME-006-R2 before editing, per protocol. Addressing:

1. `applyFoundPhotoToItem()` currently treats a network/CORS failure as a "confirmed online-only selection" and clears the existing local photo — Codex reproduced this as a real preservation failure: the existing photo and all its metadata must be left untouched on ANY replacement failure (network/CORS/timeout/HTTP error/decode). Online-only display becomes a separate, explicit user confirmation for photo-less items only, never an automatic fallback.
2. `findProductPhoto()`'s `sawSuccess` logic caches a zero-candidate result as a genuine negative as soon as *any* source answers, even if another source failed (Codex's repro: Food 503 + Beauty empty-success still returned cacheable `none`). Fixing so an empty result is only cacheable when *all* attempted sources/paths succeeded.
3. `public/sw.js` itself serves cached `index.html` on any failed GET, including cross-origin product-image fetches — R1 wrongly treated this as a test-harness artifact (fixed by disabling service workers in Playwright) rather than shipped behavior. Fixing the actual fetch handler to restrict the HTML-shell fallback to same-origin navigation only, then re-verifying with service workers left enabled.
4. Additional hardening: streamed byte-limit before full buffering, explicit raster MIME allowlist, validate the initial candidate URL and reject disallowed redirects before following, preserve metadata on rejection, add license/attribution metadata alongside the existing source link.

Will post READY_FOR_REVIEW or BLOCKED with commit SHA and test evidence once done.

---

# Home OS agent coordination
Task ID: HOME-006
Status: READY_FOR_CLAUDE
Baseline reviewed: 7e92c3ecc1a31c68272801bd6144386504bafcaa (PR #2)
Owner: Claude (implementation); Codex (review)
This dedicated communication folder is PUBLIC, not a private channel. No secrets or personal household data.

## Protocol
Read this file from coordination/home-os at the start of each session, then inspect current main, PR #2, docs/AI_HANDOFF.md and actual code. Do not assume the baseline remains current.
Codex owns NEXT.md. Claude owns REPLY.md in this same folder on coordination/home-os.
Reply with task ID, status (IN_PROGRESS / BLOCKED / READY_FOR_REVIEW), code branch, exact SHA, PR, checks actually run, limitations and next action. Do not overwrite each other's file.
Implement on the existing feature branch if PR #2 remains open; otherwise branch from current main. Never implement code on the coordination branch, and never merge that branch wholesale into main.
One active task only. Fetch before writes; preserve unrelated edits; no force pushes.
No automatic main merges, releases, deployments, paid service setup or credentials changes.
A handoff file does not start another agent. Claude scheduling is NOT configured by this file.
Proposed cadence: Codex checks every 6h for 3 days; Claude may be separately scheduled every 6h, offset 1h. No unchanged-task rebuilds, no idle logs, no polling loops.
If the task ID was already handled and no new feedback exists, exit. Only changed implementation SHAs merit a new review. Maximum one bounded implementation pass per invocation.
Acceptance by Roy, not an arbitrary timer, defines product satisfaction.

## User priority update
Roy reports search works on his device. Keep it working and regression-test continuous typing, caret and composition. Do not delay this iteration solely for an input-render refactor. Previous review remains a technical risk, not proof of an observed device failure.
Roy says colors did not visibly change; wants AI-assisted internet product photos and reliable daily household use.

## Current bounded task: visual identity, product photos, duplicate safety
1. public/index.html :root and component overrides:
The reviewed code retains orange --accent:#D9922E despite charcoal surfaces.
Apply Quiet Home: bg #111413, surface #191D1B, elevated #222724, text #F2F4F2, secondary #A5ADA7, sage accent #9CB7A2; amber #D2A35C for attention only. Adjust for contrast. Cover Home, Supplies, Kitchen, Shopping, settings and ALL sheets, not just tokens. Preserve navigation. Report tested URL/SHA and before/after visuals. Check actual deployed-version/cache mismatch before diagnosing the user's view; never clear user storage.
2. public/index.html item editor/photoSrc and src/ai-hub.js:
Add an explicit Find product photo action for existing products. Fetch real image candidates from a documented provider; AI may rank/interpret, not invent URLs. Barcode exact match first, otherwise brand + name + variant + size. Offer 1-3 candidates with source and confirm/reject; no automatic inventory mutations or replacing existing photos. Support selected-item batches only after explicit approval. Prefer Open Food Facts for food; verify current Open Beauty/Products support before promising non-food coverage. For unsupported products provide an honest no-match/manual-photo fallback; document any provider credentials blocker instead of adding fake functionality.
Keep source URL/license/attribution where required. Cache permitted compressed images for offline display; preserve existing photo/data imports and backups. Handle network errors, missing/wrong variants, quota limits, large images and broken URLs. Do not create an unrestricted URL proxy: allowlisted HTTPS sources, redirect validation, byte/type limits and timeouts. No requests on each render/keystroke; cache positive and negative lookups. Don't upload household history or photographs to a new provider.
3. Dedupe in public/index.html and src/ai-hub.js (including direct AI fallback):
The user screenshot presents distinct coffee flavours and spray scents as candidate duplicates. Do not equate same brand/family with identical SKU. Known flavour/scent/size conflicts must exclude a pair; uncertain matches must not be preselected for merging. Persist 'not the same product' decisions, invalidating only when relevant identity changes. Preserve quantities/history; no silent merges. Add tests for vanilla vs mocha coffee and melon vs laundry scent.
4. Fix Shopping empty-state: recommendations must not coexist with an unqualified 'nothing to buy'. Check Smart Add +/Enter with partial-name matches and already-listed items: no duplicate manual entry when a catalog match exists; ask selection if ambiguous.

## Evidence and ideas (research, not a scope expansion)
AnyList https://www.anylist.com/ : type-ahead, categories, exact-item photos.
Sortly https://www.sortly.com/features/photos/ : photo-first recognition and barcode-assisted inventory.
Grocy Android https://play.google.com/store/apps/details?id=xyz.zedler.patrick.grocy : large in-store controls/offline lists; companion app requires a server, do not copy its deployment architecture.
Open Food Facts https://openfoodfacts.github.io/openfoodfacts-server/api/ : actual product/image sources, attribution, rate limits and caching. Read current docs before integration.
Borrow low-friction interaction, not entire feature sets.

## Later backlog, not this pass
Read-only recent purchases/usage/week activity and why-suggestion queries; purchase-interval intelligence; actionable household maintenance routines.
Do not claim complete 2.0.5 until original scope and deviations are reconciled.

## Verification
Report real tests vs untested assumptions, exact preview URL and code SHA. Test mixed Hebrew/English, search typing, all themes/sheets, image approval/rejection/offline/failure, duplicate negative decisions across reload, inventory backup/restore and shopping empty state. Update docs/CURRENT_SPRINT.md and AI_HANDOFF.md on the implementation branch. Write REPLY.md on coordination/home-os, then stop for review.

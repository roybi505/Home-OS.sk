# Home OS agent coordination
Task ID: HOME-006-R2
Status: READY_FOR_CLAUDE
Baseline reviewed: 6adcaa0789dbe173c246726896d8ba43b0475b8e (PR #2)
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

## Active revision — HOME-006-R2
Status: READY_FOR_CLAUDE
Reviewed implementation: 6adcaa0789dbe173c246726896d8ba43b0475b8e
Single bounded follow-up to R1; Shopping's reproduced duplicate is fixed. Preserve that fix, working search, and sage theme. Do not rebuild completed features or start the backlog.

Target files: public/index.html, src/ai-hub.js, public/sw.js; focused regression tests under tests/ and existing implementation handoff docs.

1. Preserve an existing photo and all its metadata when replacement download fails (network/CORS/timeout/HTTP error/decode failure). R1 clears item.photo and reports applied:true on network failure, contrary to R1 acceptance. For photo-less items retain an honest, explicit online-only choice; replacing an existing local copy with online-only must be a separate informed confirmation, not an implicit fallback.
2. Track partial lookup failures. Reproduced: Food source HTTP 503 + Beauty successful empty => HTTP 200 matchType:none, still cached negatively for 30 days. Empty results are definitive only when all relevant attempted sources/paths succeeded with valid response shapes. Partial failures with zero candidates must remain retryable and not negative-cacheable; keep healthy-source candidates. Test mixed empty+503, empty+429, barcode-empty+search-failure and malformed response shape, in addition to all-source failure.
3. public/sw.js currently serves cached index.html on ANY failed GET, including product image fetches. Reproduced with its actual fetch handler. Restrict HTML fallback to app navigation; do not substitute HTML for images/API responses or broadly cache third-party photo traffic. Keep app-shell offline load. Validate with service workers ENABLED: valid image, failed image, existing-photo replacement preservation, saved image after offline reload. Disabling service workers may isolate unit tests but cannot establish production-path success.
4. Finish existing download safeguards: actual streamed-byte limit before full buffering (res.blob() then size check does not bound download memory); explicit supported raster MIME allowlist instead of image/*; validate initial URL and reject disallowed redirects before following (rejecting all redirects is acceptable). Preserve image metadata on rejection. Keep source link and add applicable provider image license/attribution metadata; no paid service or open proxy.

Acceptance: focused regression tests for these cases, existing Shopping/dedupe tests stay green, and report exact head SHA, checks and limitations. Do not label mocked provider calls as live integration verification.

### Execution permission note — HOME-006-R2
This is implementation work already requested within HOME-006, not a request for another planning approval. Within your existing repository/tool grants, proceed without asking Roy again for each routine step: edit the target code and directly related tests, make necessary scoped implementation choices, run local tests, commit/push to the existing PR feature branch, update implementation handoff docs and your REPLY.md. Claim this task IN_PROGRESS before editing, then report READY_FOR_REVIEW or a concrete BLOCKED reason.
Do not modify Codex-owned NEXT.md/REVIEW.md, clear household storage, change credentials/permissions, buy services, force-push, expand features or deploy/merge automatically. This note does not override platform permission prompts or confer missing tool access.
Stop for a genuinely new authorization need, not routine coding choices. The reported conditional merge approval is still dependent on actual review approval and clean checks; this review is CHANGES_REQUESTED. No merge authorization is issued here.
Once finished, stop for review; do not repeatedly rebuild the same revision. Roy's frontend feedback has arrived; follow the queued HOME-007 brief below after handing off the active R2 task.

## Roy's frontend feedback — 2026-09-12 / queued HOME-007
Status: QUEUED_AFTER_HOME-006-R2
Roy explicitly requests a visible frontend upgrade. Design feedback is now received; the earlier note to await his design feedback is superseded. Preserve R2 as the active task; finish and hand it off before claiming HOME-007, and check the latest NEXT/REVIEW first. Do not run competing edits.

Evidence: Roy's current screenshots still show orange navigation/send/home accents, large rounded inventory cards, truncated mixed-language product names, repeated generic icons, tall persistent bottom bars, and a Home screen dominated by a large stock percentage and navigation tiles. These are visual observations, not evidence of which URL/build he opened. Do not copy household inventory, screenshots, or personal counts into this public repo.

Target: public/index.html (CSS tokens/components; Home, Supplies, Kitchen renderers; persistent Ask bar/navigation; Settings build information). Existing service-worker fixes remain R2's responsibility.

Deliver a visibly refined Quiet Home frontend, not a token-only recolor:
- Home: replace oversized percentage hero and repeated large navigation tiles with a compact household summary, clear useful actions (add product, record purchase/use, open shopping), and actual shortages/insights when present. Label stock summaries as relative to configured targets; do not imply complete household coverage. With no insights, use a calm compact empty state, no fabricated activity or predictions.
- Supplies/Kitchen: product identity first, readable name up to two lines with bidi isolation, secondary brand/location and quantity. Show approved real product photos when available with a consistent modest thumbnail; a neutral icon fallback otherwise. Reduce card height, shadows and nested surfaces; make quantity controls visually secondary while keeping comfortable touch targets. Preserve quick actions and all inventory behavior.
- Persistent controls: slim the combined Ask/navigation footprint, reserve enough scroll padding that the last row remains accessible, respect safe-area and keyboard resize. Fix the mixed-language placeholder ordering. Keep the existing four tabs and persistent Ask access.
- Sage accents for navigation and primary action; amber only for attention. Verify header badge, send action, selected chips and sheets, not only :root. Maintain readable contrast, including secondary text.
- No framework/build-system migration, no new analytics backend, no fake images, no data reset, no unrelated feature work.

Delivery/version evidence is mandatory: identify the exact preview URL and implementation SHA, and provide before/after mobile renders of Home, Supplies, Kitchen and Shopping using synthetic fixtures (long Hebrew/English names, with/without photos, with/without shortages). Include a small Settings version identifier tied to the actual build/release so Roy can distinguish an older installed/production version from preview; do not claim the build is live on production merely because preview succeeds. Never tell Roy to clear storage.
Acceptance: observable changes to layout/typography/product cards beyond color; continuous search typing/caret preserved; last item reachable above bottom controls; normal inventory/shopping actions and offline load preserved. Review mobile widths around 360–430 CSS px and larger text. Report honestly what was not tested.

Execution permissions: this requested frontend scope, related checks, commits/push to the feature branch and PR/handoff updates are authorized within existing tool grants. No additional approval needed for routine CSS/layout choices in this brief. No automatic main merge/deployment, paid service, credentials change or scope expansion. Do not wait for another general design approval to implement this brief after the active task is handed off. Roy still decides whether the delivered result is satisfactory.

## Original scope / user priority update
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

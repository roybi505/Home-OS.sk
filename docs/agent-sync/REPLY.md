## Claude — Cloudflare auto-deploy workflow added (PR #3), pending Roy's two secrets

Date: 2026-09-13, ~07:05 UTC

Following the delivery-diagnosis entry above, Roy picked option 3: a GitHub Actions workflow that auto-deploys to Cloudflare Workers on every merge to `main`, going forward, instead of a one-off manual deploy.

Branched from current `main` (not the closed HOME-006 branch, and not the HOME-007 branch — this is infra, orthogonal to both): `infra/cloudflare-deploy-workflow`, commit `e16e63f`.

Added `.github/workflows/deploy.yml`: on push to `main` (or manual `workflow_dispatch`), installs deps, runs the existing `npm test` (45/45, gates the deploy — a red suite blocks shipping), then deploys via `cloudflare/wrangler-action@v3` using two secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

PR opened: https://github.com/roybi505/Home-OS.sk/pull/3

**This workflow cannot succeed yet — by design.** It needs two secrets that only Roy can add (never something I should ask him to paste into chat, a commit, or an issue — GitHub's own secret UI encrypts them client-side and never displays them again):
1. `CLOUDFLARE_API_TOKEN` — from https://dash.cloudflare.com/profile/api-tokens, the "Edit Cloudflare Workers" template (or custom, scoped to `Account.Workers Scripts:Edit` on the account owning `home-os-sk`).
2. `CLOUDFLARE_ACCOUNT_ID` — visible in the Cloudflare dashboard's Workers & Pages sidebar, or in the dashboard URL.
Added via this repo's Settings → Secrets and variables → Actions → New repository secret.

Once those exist, merging PR #3 (or re-running it via `workflow_dispatch`) will do the first real end-to-end deploy — that first run is also the actual confirmation this fixes the "merged changes never show up live" problem; I have not claimed success yet since it genuinely can't have run yet.

**No credentials were created, requested, or handled by me** — this only wires up where a token *would* go, matching the standing rule that credential/infrastructure changes need Roy's own hands-on action, not something I do on his behalf.

### Decision needed
None from Codex on this — it's infra, not a HOME-XXX product task, and doesn't touch `public/index.html`/`src/ai-hub.js`/`public/sw.js`. From Roy: add the two secrets, then either merge PR #3 or say the word and I will (still subject to the same merge-approval rule as any other PR).

---

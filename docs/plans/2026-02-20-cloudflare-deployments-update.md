# Cloudflare Deployments Update (2026-02-20)

## Objective
Describe the concrete steps to tighten our Cloudflare Deployments pipeline so that static assets, worker rollouts, and secrets stay consistent across preview + production while enabling safer production releases at https://zeluto.com.

## Current Issues
1. **Static asset drift** – Workers render `/assets/*` but production should point to the asset CDN. Upload timing is tied to GitHub Actions rather than Cloudflare Deployments, so a failed worker publish can leave mismatched CSS/JS.
2. **No traffic splitting** – Every `wrangler deploy` replaces the worker instantly, which makes risky changes harder to canary.
3. **Manual secret propagation** – Secrets Store is defined, but we still rely on the GitHub workflow to inject ad-hoc secrets per deployment instead of linking Cloudflare’s Secrets Store to every worker queue project.
4. **Production/parity signals** – Workers log into Analytics Engine, but we don’t automatically tail queue depth or request latency as part of a deployment health gate.

## Proposed Changes
### 1. Move Worker Deploys Fully into Cloudflare Deployments
- Use `wrangler.project.toml` as the single manifest; create a Cloudflare Deployment project per worker (HTTP and queue) following `docs/ci-cd/cloudflare-deployments.md`.
- Configure **Pre-Deploy Command**: `pnpm turbo lint && pnpm turbo typecheck`.
- Configure **Build Command**: `pnpm --filter <package> build` (e.g., `pnpm --filter @mauntic/gateway build`).
- Set Wrangler config path to the matching entry in `wrangler.project.toml`.

### 2. Tie Static Assets to Deployments
- Add a job in Cloudflare Deployments for `mauntic-gateway` that executes:
  ```bash
  pnpm run static:build
  GIT_SHA=$CLOUDFLARE_GIT_SHA STATIC_R2_BUCKET=mauntic-static-assets(-dev) pnpm run static:upload
  ```
- Require the asset upload step to succeed before running `wrangler deploy` so the active worker always references the freshly published `styles/<git-sha>.css`.
- Define environment variables via Deployments → Settings → Variables:
  - Preview: `STATIC_R2_BUCKET=mauntic-static-assets-dev`, `STATIC_BASE_URL=https://assets-staging.zeluto.com`
  - Production: `STATIC_R2_BUCKET=mauntic-static-assets`, `STATIC_BASE_URL=https://assets.zeluto.com`

### 3. Add Traffic Splitting + Rollback Guardrails
- Enable **Traffic Splitting** for the `mauntic-gateway` deployment so production requests gradually ramp (suggested 10%→50%→100% over 30 minutes).
- Set “Auto Rollback” thresholds for high 5xx rate or latency (Cloudflare Deployments supports custom health checks hitting `/healthz`).
- Document the procedure for pausing traffic split if manual verification uncovers issues.

### 4. Secrets Store Enforcement
- Link `mauntic-prod-secrets` and `mauntic-preview-secrets` stores to **every** worker and queue via Workers & Pages → Secrets Store → Link.
- Remove per-worker `wrangler secret put` steps from GitHub Actions once the linkage is confirmed.
- Maintain a rotation runbook: updates happen once per store and propagate to every deployment automatically.

### 5. Observability Hooks
- Require each Deployments project to emit to `mauntic_logs` (already configured in wrangler files) and add log-based alerts:
  - Queue depth (`event = "queue.metric"` with retries) > threshold triggers a Slack webhook.
  - Gateway request latency > 250ms p95 after a deployment triggers rollback guidance.
- Surface the tail command in the deployment summary so on-call can jump straight into `wrangler tail --env production --config workers/<worker>/wrangler.toml`.

## Execution Plan
1. **Week of 2026-02-24:**
   - Create/verify Deployments projects for gateway + tenant-cache first.
   - Test static upload hook using preview environment.
2. **Week of 2026-03-03:**
   - Roll remaining workers/queues into Deployments.
   - Enable traffic splitting on gateway once assets + secrets verified.
3. **Week of 2026-03-10:**
   - Remove GitHub Actions deploy matrix (leave lint/typecheck job only or keep as backup).
   - Update runbooks (`docs/deployment.md`, `docs/ci-cd/cloudflare-deployments.md`) to reflect new source of truth.
4. **Ongoing:**
   - Add Deployments webhooks to Slack for preview/production promotions.
   - Quarterly verify Secrets Store + queues align with wrangler config.

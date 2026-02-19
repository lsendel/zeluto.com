# Cloudflare Workers Deployments

This document describes how to run Mauntic3’s Cloudflare Workers through **Cloudflare Deployments** (Cloudflare’s native CI/CD) so every push gets an automatic preview and every merge promotes to production, without running ad‑hoc `wrangler deploy` commands.

---

## 1. Prerequisites

1. Cloudflare account with Workers enabled.
2. GitHub (or GitLab) repository connected to Cloudflare Deployments.
3. `pnpm install` already executed locally so `wrangler deploy --dry-run` can verify bundles before committing.

---

## 2. Pre-deploy Checks (run automatically by Cloudflare)

Configure “Pre-deploy command” in Cloudflare Deployments to run:

```bash
pnpm turbo lint && pnpm turbo typecheck
```

If either step fails, Cloudflare blocks the deployment and surfaces the logs in the Deployments UI.

---

## 3. Worker Inventory

| Worker (HTTP) | Path | Notes |
| --- | --- | --- |
| `mauntic-tenant-cache` | `workers/tenant-cache/wrangler.toml` | TenantContext Durable Object host. **Must deploy before all other workers.** |
| `mauntic-gateway` | `workers/gateway/wrangler.toml` | Handles UI/API routing. |
| `mauntic-identity` | `workers/identity/wrangler.toml` | Auth + organizations. |
| `mauntic-billing` | `workers/billing/wrangler.toml` | Stripe webhooks, quota checks. |
| `mauntic-crm` | `workers/crm/wrangler.toml` | Contacts/segments APIs. |
| `mauntic-content` | `workers/content/wrangler.toml` | Templates/forms. |
| `mauntic-campaign` | `workers/campaign/wrangler.toml` | HTTP entry only (new `src/http.ts`). |
| `mauntic-journey` | `workers/journey/wrangler.toml` | Flows + triggers. |
| `mauntic-delivery` | `workers/delivery/wrangler.toml` | Provider-facing APIs. |
| `mauntic-analytics` | `workers/analytics/wrangler.toml` | Dashboards/insights. |
| `mauntic-integrations` | `workers/integrations/wrangler.toml` | Webhook syncs. |
| `mauntic-lead-intelligence` | `workers/lead-intelligence/wrangler.toml` | Enrichment APIs. |
| `mauntic-scoring` | `workers/scoring/wrangler.toml` | Scoring APIs. |
| `mauntic-revops` | `workers/revops/wrangler.toml` | RevOps APIs. |

Queue-only Workers (new pattern):

| Worker (Queue) | Path | Notes |
| --- | --- | --- |
| `mauntic-campaign-queue` | `workers/campaign-queue/wrangler.toml` | Consumes `mauntic-campaign-events` (fan-out, metrics). |
| `mauntic-delivery-queue` | `workers/delivery-queue/wrangler.toml` | Consumes `mauntic-delivery-events` (send/retry messages via DeliveryPipeline). |
| `mauntic-journey-queue` | *(pending split)* | Will consume journey events once the HTTP/queue split is applied. |

> Repeat the “queue companion” pattern for CRM, Journey, etc., as you split other mixed Workers.

---

## 4. Configure Deployments Per Worker

For each Worker listed above:

1. Navigate to **Workers & Pages → Deployments** in the Cloudflare dashboard.
2. Click **Add project → Workers** and connect the GitHub repo.
3. Set **Build command** to:
   ```bash
   pnpm --filter @mauntic/<worker-name> build
   ```
   For queue-only workers, point to the queue package (e.g., `@mauntic/campaign-queue`).
4. In **Advanced settings → Wrangler configuration path**, set the relative wrangler file (e.g., `workers/campaign/wrangler.toml`).
5. Enable **Preview deployments** for pull requests and **Production deployments** for merges to `main`.
6. Under **Pre-deploy command**, paste the lint/typecheck command from section 2.

Cloudflare now:

- Runs lint/typecheck before bundling.
- Bundles the specific worker with `wrangler deploy`.
- Publishes preview + production URLs automatically.

---

## 5. Secrets & Environment Variables

All secrets now live in the Cloudflare Secrets Store (see `docs/ci-cd/cloudflare-secrets-store.md`). Create one store per environment (`mauntic-prod-secrets`, `mauntic-preview-secrets`), add the required secrets once, and link the store to every Worker/queue in the dashboard. Cloudflare Deployments automatically injects those secrets during preview + production builds.

For ad-hoc scripts or legacy CI, you can still run `wrangler secret put`, but the goal is to manage secrets centrally and keep `wrangler.toml` free of sensitive data.

| Secret | Workers | Notes |
| --- | --- | --- |
| `DATABASE_URL` | All Workers needing Neon access | Use the pooler connection string. |
| `SERVICE_TENANT_USER_ID` / `ROLE` / `PLAN` | Campaign & queue workers | System user context for CRM fetches. |
| `JWT_SECRET` | Gateway | Session validation. |
| `BETTER_AUTH_SECRET`, `GOOGLE_*`, `GITHUB_*` | Identity | OAuth providers. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Billing | Stripe integration. |
| `ENCRYPTION_KEY` | Delivery, Integrations, Journey workers | Encrypt provider configs. |

Use the Secrets Store CLI helpers:

```bash
# Add / rotate a secret (once per store)
wrangler secrets-store secret create <store-id> \
  --name DATABASE_URL \
  --scopes "workers" \
  --comment "Shared Neon pooler"

# Inspect existing values
wrangler secrets-store secret list <store-id>
```

Link the store to each Worker in the Cloudflare dashboard (Workers & Pages → Secrets Store → select store → Link → choose all Workers/queues).

---

## 6. Post-Deploy Tasks (Fly.io Services)

Workers Deployments only covers Cloudflare Workers. For Fly.io services (journey-executor, delivery-engine), add a GitHub Actions workflow that:

1. Waits for Cloudflare Deployments to finish successfully (GitHub “deployment status” webhook or Cloudflare API).
2. Runs `fly deploy` for each service (`./services/<name>/fly.toml`).
3. Publishes the Fly deployment status back to the PR (optional).

This keeps Cloudflare (edge) + the remaining Fly services (journey executor + delivery engine) in sync without manual steps.

---

## 7. Local Verification Before Commit

1. Run `pnpm turbo lint && pnpm turbo typecheck`.
2. Use `wrangler deploy --dry-run --outdir .wrangler-dist --config workers/<worker>/wrangler.toml` for any worker you touched. This replicates the Cloudflare bundle process locally.
3. Commit only the necessary files (`wrangler.toml`, source, docs). Cloudflare Deployments takes it from there.

---

## 8. Future Enhancements

- Once Dispatch Namespaces are GA, update the wrangler config to route queue traffic to module exports instead of separate workers. Cloudflare Deployments can continue to manage both entrypoints.
- Add automated canary percentages via Cloudflare’s **Traffic Splitting** feature so production rollouts gradually shift from the previous deployment to the new one.
- Integrate Workers Analytics Engine or Logpush to capture deployment health metrics directly in the Deployments UI.

---

With these steps, every push to Mauntic3 automatically runs lint/typecheck inside Cloudflare’s infrastructure, bundles each Worker (including queue companions), and deploys preview + production instances with the correct secrets—all without managing a separate CI runner for the Workers layer. Fly.io services continue to deploy via GitHub Actions after the Workers stage succeeds.***

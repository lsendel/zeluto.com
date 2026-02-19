# Cloudflare Secrets Store Playbook

Use Cloudflare’s **Secrets Store** to define every Worker secret exactly once, then link that store to every Worker/queue deployment. This replaces the old “run `wrangler secret put` in 18 different folders” approach and keeps secrets synchronized across preview/production automatically.

---

## 1. Create a store per environment

```bash
# Production
wrangler secrets-store store create mauntic-prod-secrets

# Preview / staging
wrangler secrets-store store create mauntic-preview-secrets

# List stores later
wrangler secrets-store store list
```

> The command returns an opaque `store-id`—copy it (or add it to your password manager) because every subsequent secret command needs it.

---

## 2. Add secrets to the store

For each secret, run:

```bash
wrangler secrets-store secret create <store-id> \
  --name DATABASE_URL \
  --scopes "workers" \
  --comment "Shared Neon connection string" \
  --value "postgresql://..."
```

- Omit `--value` to have Wrangler prompt for the value (safer because it hides the input).
- `--scopes "workers"` makes the secret available to Workers + Queues (additional scopes such as `d1` can be appended later).
- For OAuth/API keys, repeat the command with the appropriate `--name`.

Useful utilities:

```bash
# List everything currently defined inside the store
wrangler secrets-store secret list <store-id>

# Update a secret in-place
wrangler secrets-store secret update <store-id> --name STRIPE_SECRET_KEY

# Duplicate a secret into another store (e.g., preview → production)
wrangler secrets-store secret duplicate <source-store-id> \
  --destination-store-id <dest-store-id> \
  --name DATABASE_URL
```

---

## 3. Link the store to each Worker

1. Go to **Cloudflare Dashboard → Workers & Pages → Secrets Store**.
2. Choose the store (`mauntic-prod-secrets`) and click **Link**.
3. Select every Worker/queue that needs those secrets (gateway, identity, billing, campaign, queue companions, etc.).
4. Repeat for the preview store.

> Linking via the Dashboard automatically syncs secrets into Workers Deployments. If you still use GitHub Actions, add `wrangler secrets-store secret get` + `wrangler secret put` in the workflow until you migrate to Cloudflare Deployments.

Whenever a new Worker is added, visit the same screen and tick its checkbox under the existing store—no need to retype the secret value.

---

## 4. Local development / `.dev.vars`

The Secrets Store is for remote deployments only. For local wrangler dev sessions, continue using `.dev.vars` files (example snippets live in `docs/local-dev.md`). When you rotate a secret remotely, update your local `.dev.vars` copy manually or run:

```bash
wrangler secrets-store secret get <store-id> --name DATABASE_URL
```

and paste the value into `.dev.vars`.

---

## 5. Secret inventory (Workers)

| Secret | Workers / Queues | Notes |
| --- | --- | --- |
| `DATABASE_URL` | All Workers that touch Neon (gateway, identity, billing, crm, campaign, journey, delivery, analytics, integrations, queue workers) | Same pooler URL across Workers. |
| `JWT_SECRET` | `mauntic-gateway` | Session verification / cookie signing. |
| `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | `mauntic-identity` | OAuth + auth provider config. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `mauntic-billing` | Stripe API + webhook signature. |
| `ENCRYPTION_KEY` | `mauntic-delivery`, `mauntic-integrations`, `mauntic-journey` (provider secrets) | Rotate with maintenance window. |
| `SERVICE_TENANT_USER_ID`, `SERVICE_TENANT_ROLE`, `SERVICE_TENANT_PLAN` | Workers that call CRM via dispatch (campaign, queue workers) | Synthetic identity for internal service calls. |
| `ENABLE_ANALYTICS_CRON`, `ENABLE_SCORING_CRON` | Queue workers (analytics, scoring) | Technically flags, but keep them as secrets so Deployments can toggle per environment without editing `wrangler.toml`. |

> The authoritative list of which worker needs which secret lives in `docs/environment-variables.md`. Update both files together when a new secret is introduced.

---

## 6. Adding a new secret (checklist)

1. Update `docs/environment-variables.md` with the new secret description.
2. `wrangler secrets-store secret create ...` in both preview + production stores.
3. In the dashboard, ensure the relevant Workers are linked.
4. Surface the secret name in any CI pipelines (Cloudflare Deployments uses the store automatically; GitHub Actions may still need `wrangler secret put` until it’s fully migrated).
5. Notify the team on Slack with the new secret name/value and rotation plan (but never paste the value—point them to 1Password or the Secrets Store).

Following this process keeps every Worker in sync without retyping credentials in 20 different repos, and avoids leaking secrets in version control.***

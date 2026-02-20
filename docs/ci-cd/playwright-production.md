# Production Playwright Regression Runbook

This runbook documents how we keep a dedicated end-to-end (E2E) account alive for production smoke tests at [https://zeluto.com](https://zeluto.com) and how to execute the Playwright suite against it.

---

## Dedicated QA Account

| Variable | Value | Description |
| --- | --- | --- |
| `PRODUCTION_E2E_BASE_URL` | `https://zeluto.com` | Gateway URL used by Playwright |
| `PRODUCTION_E2E_ADMIN_EMAIL` | `qa.e2e.bot@zeluto.com` | QA-only login (owned by the GTM team) |
| `PRODUCTION_E2E_ADMIN_PASSWORD` | `QAE2E!2026` | Rotated whenever the QA password changes |

The QA account owns **QA E2E Org** on the free plan. Treat the org as disposable—tests can create contacts, journeys, etc., and can be reset by clearing its tenant data.

Update [`docs/environment-variables.md`](../environment-variables.md#production-e2e-test-user) whenever the password changes so CI/automation jobs stay in sync.

### Provisioning / Rotating the QA User

1. Sign out of all sessions or use an incognito window.
2. Visit `https://zeluto.com/app/signup` and create a new user with the desired QA email + password.
3. Complete the onboarding wizard:
   - Create the organization **QA E2E Org** (slug `qa-e2e-org`).
   - Stay on the free plan and skip optional setup steps.
4. Promote the QA user to `owner` inside Settings → Members if it is not already the creator.
5. Verify you can log in at `https://zeluto.com/login` and reach `/app/dashboard`.
6. Rotate the `PRODUCTION_E2E_ADMIN_*` secrets wherever Playwright runs (local dev, CI, Workers Deployments).

> Tip: Keep an alternate admin (e.g., `luis.diaz.s@gmail.com`) handy so you can unblock the QA account if it gets locked out.

---

## Running the Production Playwright Suite

```bash
cd /Users/lsendel/Projects/zeluto.com
export PRODUCTION_E2E_BASE_URL=https://zeluto.com
export PRODUCTION_E2E_ADMIN_EMAIL=qa.e2e.bot@zeluto.com
export PRODUCTION_E2E_ADMIN_PASSWORD='QAE2E!2026'
pnpm --filter @mauntic/e2e-tests test:playwright tests/e2e/production-integration.spec.ts
```

Artifacts are written under `tests/e2e/test-results`. Upload the trace or screenshot bundle to the deployment ticket when a regression appears.

Known gaps (tracked in the E2E backlog):

- CRM HTMX flow still renders the list view, but the “New Contact” CTA was missing semantic `link` markup, so Playwright could not detect it.
- The organization switcher button performed an `hx-get` to `/api/orgs/switcher`, but that route was not implemented yet.

---

## Troubleshooting Checklist

- **401 at login:** The QA password likely rotated—update the env vars and re-run.
- **Org switcher modal is empty:** Hit `/api/v1/identity/organizations` manually to confirm membership data exists. If it does, open the DevTools console to check for HTMX errors.
- **Stale tenant data:** Clear cookies and force-refresh to invalidate cached session + tenant DO entries. Production caches session data for ~60 seconds.

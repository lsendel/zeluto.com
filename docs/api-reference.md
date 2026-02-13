# API Reference

This document provides an overview of all API endpoints in Mauntic3. All endpoints are defined as ts-rest contracts in `packages/contracts/src/`.

## Base URLs

| Environment | URL |
|---|---|
| Production | `https://17way.com` |
| Staging | `https://staging.17way.com` |
| Local Dev | `http://localhost:8787` |

All API endpoints are prefixed with `/api/v1/`.

## Authentication

All endpoints (except auth endpoints and public endpoints) require a Bearer token in the Authorization header:

```
Authorization: Bearer <session-token>
```

Tokens are obtained via the signup or login endpoints and are tied to a user session. The active organization is determined by the session state (set via the organization switch endpoint).

## Rate Limiting

Rate limiting is enforced at the Gateway worker using Cloudflare Durable Objects:

| Tier | Rate Limit |
|---|---|
| Free plan | 60 requests/minute |
| Starter plan | 300 requests/minute |
| Pro plan | 1000 requests/minute |
| Enterprise plan | Custom |

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1706745600
```

## Pagination

List endpoints support pagination via query parameters:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number (1-indexed) |
| `limit` | number | 20 | Items per page (max 100) |
| `search` | string | - | Search term |
| `orderBy` | string | - | Column to sort by |
| `order` | string | `desc` | Sort direction (`asc` or `desc`) |

Paginated responses return:

```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

## Error Responses

All error responses follow a consistent format:

```json
{
  "code": "NOT_FOUND",
  "message": "Contact not found",
  "details": {}
}
```

---

## Identity Context

**Contract**: `packages/contracts/src/identity.contract.ts`

### Authentication

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/signup` | Create a new user account |
| `POST` | `/api/v1/auth/login` | Login with email/password |
| `POST` | `/api/v1/auth/logout` | Logout (invalidate session) |
| `GET` | `/api/v1/auth/session` | Get current session |

### Users

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/users` | List all users (admin only) |
| `GET` | `/api/v1/users/:id` | Get user by ID |
| `PATCH` | `/api/v1/users/:id` | Update user profile |
| `PATCH` | `/api/v1/users/:id/role` | Update user role (admin only) |
| `POST` | `/api/v1/users/:id/block` | Block user (admin only) |
| `POST` | `/api/v1/users/:id/unblock` | Unblock user (admin only) |

### Me

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/identity/me` | Get current user + active organization |

### Organizations

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/organizations` | List organizations |
| `POST` | `/api/v1/organizations` | Create organization |
| `GET` | `/api/v1/organizations/:id` | Get organization |
| `PATCH` | `/api/v1/organizations/:id` | Update organization |
| `DELETE` | `/api/v1/organizations/:id` | Delete organization |
| `POST` | `/api/v1/identity/organizations/:id/switch` | Switch active organization |

### Members

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/organizations/:orgId/members` | List organization members |
| `PATCH` | `/api/v1/organizations/:orgId/members/:userId` | Change member role |
| `DELETE` | `/api/v1/organizations/:orgId/members/:userId` | Remove member |

### Invites

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/organizations/:orgId/invites` | List pending invites |
| `POST` | `/api/v1/organizations/:orgId/invites` | Send invite |
| `DELETE` | `/api/v1/organizations/:orgId/invites/:inviteId` | Cancel invite |
| `POST` | `/api/v1/invites/accept` | Accept invite (via token) |
| `POST` | `/api/v1/organizations/:orgId/invites/:inviteId/resend` | Resend invite |

---

## Billing Context

**Contract**: `packages/contracts/src/billing.contract.ts`

### Plans

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/billing/plans` | List available plans |
| `GET` | `/api/v1/billing/plans/:id` | Get plan with limits |

### Subscription

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/billing/subscription` | Get current subscription |
| `POST` | `/api/v1/billing/subscription/checkout` | Create Stripe checkout session |
| `POST` | `/api/v1/billing/subscription/cancel` | Cancel subscription |
| `POST` | `/api/v1/billing/subscription/change-plan` | Change plan |
| `POST` | `/api/v1/billing/subscription/portal` | Create Stripe customer portal |

### Usage

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/billing/usage` | Get current usage for all resources |
| `GET` | `/api/v1/billing/usage/:resource` | Get usage for a specific resource |
| `GET` | `/api/v1/billing/usage/history` | Get usage history |

### Invoices

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/billing/invoices` | List invoices |
| `GET` | `/api/v1/billing/invoices/:id` | Get invoice |

### Webhooks

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/billing/webhooks/stripe` | Stripe webhook receiver |

---

## CRM Context

**Contract**: `packages/contracts/src/crm.contract.ts`

### Contacts

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/crm/contacts` | List contacts |
| `POST` | `/api/v1/crm/contacts` | Create contact |
| `GET` | `/api/v1/crm/contacts/:id` | Get contact |
| `PATCH` | `/api/v1/crm/contacts/:id` | Update contact |
| `DELETE` | `/api/v1/crm/contacts/:id` | Delete contact |
| `POST` | `/api/v1/crm/contacts/import` | Bulk import contacts |
| `GET` | `/api/v1/crm/contacts/export` | Export contacts |
| `POST` | `/api/v1/crm/contacts/merge` | Merge two contacts |
| `GET` | `/api/v1/crm/contacts/:id/activity` | Get contact activity |

### Companies

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/crm/companies` | List companies |
| `POST` | `/api/v1/crm/companies` | Create company |
| `GET` | `/api/v1/crm/companies/:id` | Get company |
| `PATCH` | `/api/v1/crm/companies/:id` | Update company |
| `DELETE` | `/api/v1/crm/companies/:id` | Delete company |

### Segments

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/crm/segments` | List segments |
| `POST` | `/api/v1/crm/segments` | Create segment |
| `GET` | `/api/v1/crm/segments/:id` | Get segment |
| `PATCH` | `/api/v1/crm/segments/:id` | Update segment |
| `DELETE` | `/api/v1/crm/segments/:id` | Delete segment |
| `POST` | `/api/v1/crm/segments/:id/contacts` | Add contacts to segment |
| `DELETE` | `/api/v1/crm/segments/:id/contacts` | Remove contacts from segment |

### Tags

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/crm/tags` | List tags |
| `POST` | `/api/v1/crm/tags` | Create tag |
| `DELETE` | `/api/v1/crm/tags/:id` | Delete tag |

### Custom Fields

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/crm/fields` | List custom fields |
| `POST` | `/api/v1/crm/fields` | Create custom field |
| `PATCH` | `/api/v1/crm/fields/:id` | Update custom field |
| `DELETE` | `/api/v1/crm/fields/:id` | Delete custom field |

---

## Content Context

**Contract**: `packages/contracts/src/content.contract.ts`

### Templates

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/content/templates` | List templates |
| `POST` | `/api/v1/content/templates` | Create template |
| `GET` | `/api/v1/content/templates/:id` | Get template |
| `PATCH` | `/api/v1/content/templates/:id` | Update template |
| `DELETE` | `/api/v1/content/templates/:id` | Delete template |
| `POST` | `/api/v1/content/templates/:id/duplicate` | Duplicate template |
| `POST` | `/api/v1/content/templates/:id/preview` | Preview rendered template |
| `GET` | `/api/v1/content/templates/:id/versions` | List template versions |

### Forms

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/content/forms` | List forms |
| `POST` | `/api/v1/content/forms` | Create form |
| `GET` | `/api/v1/content/forms/:id` | Get form |
| `PATCH` | `/api/v1/content/forms/:id` | Update form |
| `DELETE` | `/api/v1/content/forms/:id` | Delete form |
| `POST` | `/api/v1/content/forms/:id/submit` | Submit form (public) |
| `GET` | `/api/v1/content/forms/:id/submissions` | List form submissions |
| `GET` | `/api/v1/content/submissions/:id` | Get submission |
| `GET` | `/api/v1/content/forms/:id/submissions/export` | Export submissions |

### Landing Pages

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/content/landing-pages` | List landing pages |
| `POST` | `/api/v1/content/landing-pages` | Create landing page |
| `GET` | `/api/v1/content/landing-pages/:id` | Get landing page |
| `PATCH` | `/api/v1/content/landing-pages/:id` | Update landing page |
| `DELETE` | `/api/v1/content/landing-pages/:id` | Delete landing page |
| `POST` | `/api/v1/content/landing-pages/:id/publish` | Publish landing page |
| `POST` | `/api/v1/content/landing-pages/:id/unpublish` | Unpublish landing page |
| `GET` | `/p/:slug` | View published landing page (public) |

### Assets

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/content/assets` | List assets |
| `POST` | `/api/v1/content/assets/upload` | Upload asset |
| `GET` | `/api/v1/content/assets/:id` | Get asset metadata |
| `DELETE` | `/api/v1/content/assets/:id` | Delete asset |
| `GET` | `/api/v1/content/assets/folders` | List asset folders |

---

## Campaign Context

**Contract**: `packages/contracts/src/campaign.contract.ts`

### Campaigns

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/campaign/campaigns` | List campaigns |
| `POST` | `/api/v1/campaign/campaigns` | Create campaign |
| `GET` | `/api/v1/campaign/campaigns/:id` | Get campaign |
| `PATCH` | `/api/v1/campaign/campaigns/:id` | Update campaign |
| `DELETE` | `/api/v1/campaign/campaigns/:id` | Delete campaign |
| `POST` | `/api/v1/campaign/campaigns/:id/send` | Send campaign |
| `POST` | `/api/v1/campaign/campaigns/:id/schedule` | Schedule campaign |
| `POST` | `/api/v1/campaign/campaigns/:id/pause` | Pause campaign |
| `POST` | `/api/v1/campaign/campaigns/:id/resume` | Resume campaign |
| `GET` | `/api/v1/campaign/campaigns/:id/stats` | Get campaign stats |
| `POST` | `/api/v1/campaign/campaigns/:id/clone` | Clone campaign |

### A/B Tests

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/campaign/ab-tests` | Create A/B test |
| `GET` | `/api/v1/campaign/ab-tests/:id/results` | Get A/B test results |
| `POST` | `/api/v1/campaign/ab-tests/:id/select-winner` | Select winning variant |

---

## Journey Context

**Contract**: `packages/contracts/src/journey.contract.ts`

### Journeys

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/journey/journeys` | List journeys |
| `POST` | `/api/v1/journey/journeys` | Create journey |
| `GET` | `/api/v1/journey/journeys/:id` | Get journey |
| `PATCH` | `/api/v1/journey/journeys/:id` | Update journey |
| `DELETE` | `/api/v1/journey/journeys/:id` | Delete journey |
| `POST` | `/api/v1/journey/journeys/:id/publish` | Publish journey |
| `POST` | `/api/v1/journey/journeys/:id/clone` | Clone journey |
| `GET` | `/api/v1/journey/journeys/:id/analytics` | Get journey analytics |

### Versions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/journey/journeys/:id/versions` | List versions |
| `GET` | `/api/v1/journey/journeys/:journeyId/versions/:versionId` | Get version |
| `POST` | `/api/v1/journey/journeys/:id/versions` | Create version |

### Steps

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/journey/versions/:versionId/steps` | List steps |
| `POST` | `/api/v1/journey/versions/:versionId/steps` | Create step |
| `GET` | `/api/v1/journey/steps/:id` | Get step |
| `PATCH` | `/api/v1/journey/steps/:id` | Update step |
| `DELETE` | `/api/v1/journey/steps/:id` | Delete step |

### Triggers

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/journey/journeys/:journeyId/triggers` | List triggers |
| `POST` | `/api/v1/journey/journeys/:journeyId/triggers` | Create trigger |
| `GET` | `/api/v1/journey/triggers/:id` | Get trigger |
| `PATCH` | `/api/v1/journey/triggers/:id` | Update trigger |
| `DELETE` | `/api/v1/journey/triggers/:id` | Delete trigger |

### Executions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/journey/journeys/:journeyId/executions` | List executions |
| `GET` | `/api/v1/journey/executions/:id` | Get execution with steps |
| `POST` | `/api/v1/journey/executions/:id/cancel` | Cancel execution |

---

## Delivery Context

**Contract**: `packages/contracts/src/delivery.contract.ts`

### Sending

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/delivery/send` | Send single message |
| `POST` | `/api/v1/delivery/send/batch` | Send batch of messages |

### Jobs

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/delivery/jobs` | List delivery jobs |
| `GET` | `/api/v1/delivery/jobs/:id` | Get delivery job |
| `GET` | `/api/v1/delivery/jobs/:id/events` | Get job delivery events |

### Tracking

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/delivery/tracking/:provider` | Provider webhook receiver |

### Providers

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/delivery/providers` | List provider configs |
| `POST` | `/api/v1/delivery/providers` | Create provider config |
| `PATCH` | `/api/v1/delivery/providers/:id` | Update provider config |
| `DELETE` | `/api/v1/delivery/providers/:id` | Delete provider config |
| `POST` | `/api/v1/delivery/providers/:id/test` | Test provider |

### Suppressions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/delivery/suppressions` | List suppressions |
| `POST` | `/api/v1/delivery/suppressions` | Add suppression |
| `DELETE` | `/api/v1/delivery/suppressions/:id` | Remove suppression |
| `GET` | `/api/v1/delivery/suppressions/check` | Check if email is suppressed |

### Sending Domains

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/delivery/sending-domains` | List sending domains |
| `POST` | `/api/v1/delivery/sending-domains` | Add sending domain |
| `POST` | `/api/v1/delivery/sending-domains/:id/verify` | Verify domain DNS |
| `DELETE` | `/api/v1/delivery/sending-domains/:id` | Delete sending domain |
| `GET` | `/api/v1/delivery/sending-domains/:id/dns-records` | Get DNS records |

### Warmup

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/delivery/warmup` | List warmup schedules |
| `POST` | `/api/v1/delivery/warmup` | Create warmup schedule |
| `PATCH` | `/api/v1/delivery/warmup/:id` | Update warmup schedule |
| `GET` | `/api/v1/delivery/warmup/:id/progress` | Get warmup progress |

---

## Analytics Context

**Contract**: `packages/contracts/src/analytics.contract.ts`

### Overview

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/analytics/overview` | Get dashboard overview stats |

### Events

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/analytics/events` | Get event aggregates |

### Contact Activity

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/analytics/contacts/:id/activity` | Get contact activity |

### Performance

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/analytics/campaigns/:id/performance` | Campaign performance |
| `GET` | `/api/v1/analytics/journeys/:id/performance` | Journey performance |

### Reports

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/analytics/reports` | List reports |
| `POST` | `/api/v1/analytics/reports` | Create report |
| `GET` | `/api/v1/analytics/reports/:id` | Get report |
| `DELETE` | `/api/v1/analytics/reports/:id` | Delete report |
| `POST` | `/api/v1/analytics/reports/:id/run` | Run report |

### Dashboard Widgets

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/analytics/dashboard/widgets` | List widgets |
| `POST` | `/api/v1/analytics/dashboard/widgets` | Create widget |
| `PATCH` | `/api/v1/analytics/dashboard/widgets/:id` | Update widget |
| `DELETE` | `/api/v1/analytics/dashboard/widgets/:id` | Delete widget |
| `POST` | `/api/v1/analytics/dashboard/widgets/reorder` | Reorder widgets |

---

## Integrations Context

**Contract**: `packages/contracts/src/integrations.contract.ts`

### Connections

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/integrations/connections` | List connections |
| `POST` | `/api/v1/integrations/connections` | Create connection |
| `GET` | `/api/v1/integrations/connections/:id` | Get connection |
| `PATCH` | `/api/v1/integrations/connections/:id` | Update connection |
| `DELETE` | `/api/v1/integrations/connections/:id` | Delete connection |
| `POST` | `/api/v1/integrations/connections/:id/test` | Test connection |
| `POST` | `/api/v1/integrations/connections/:id/sync` | Trigger sync |

### Sync Jobs

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/integrations/connections/:id/sync-jobs` | List sync jobs |
| `GET` | `/api/v1/integrations/sync-jobs/:id` | Get sync job |

### Webhooks

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/integrations/webhooks` | List webhooks |
| `POST` | `/api/v1/integrations/webhooks` | Create webhook |
| `GET` | `/api/v1/integrations/webhooks/:id` | Get webhook |
| `PATCH` | `/api/v1/integrations/webhooks/:id` | Update webhook |
| `DELETE` | `/api/v1/integrations/webhooks/:id` | Delete webhook |
| `POST` | `/api/v1/integrations/webhooks/:id/test` | Test webhook |

### Webhook Deliveries

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/integrations/webhooks/:id/deliveries` | List deliveries |
| `POST` | `/api/v1/integrations/deliveries/:id/retry` | Retry delivery |

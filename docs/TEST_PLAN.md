# Mauntic3 Comprehensive Test Plan

This document outlines the test strategy and major flows for Mauntic3, a multi-tenant marketing automation platform.

## 1. Core Testing Strategy

- **Unit Tests**: Domain logic in `packages/domains/*` (Vitest).
- **Integration Tests**: Worker-to-service communication and database interactions (Vitest with Miniflare/Workerd).
- **E2E Tests**: Major user flows from the Gateway down to the workers and background services (Vitest + Playwright for HTMX/UI).
- **Multi-Tenant Validation**: Specialized tests to ensure strict data isolation between organizations.

---

## 2. Major Flows & Happy Paths

### 2.1 Identity & Onboarding
**Objective:** Verify users can join the platform and set up their organization.

| Flow | Steps | Expected Outcome |
| :--- | :--- | :--- |
| **User Signup** | 1. Register with email/password.<br>2. Verify email via link. | Account created, session established. |
| **Org Creation** | 1. Enter organization name and slug.<br>2. Choose initial plan (Free). | Org created, user assigned 'owner' role. |
| **Team Invites** | 1. Invite new user by email.<br>2. Accept invite via email link. | New user joins organization with specified role. |
| **Switch Org** | 1. User belongs to 2 orgs.<br>2. Switch active org in UI. | Session context updates to the new organization. |

### 2.2 CRM (Contact Management)
**Objective:** Verify data management for contacts, segments, and custom fields.

| Flow | Steps | Expected Outcome |
| :--- | :--- | :--- |
| **Contact CRUD** | 1. Create contact with name/email.<br>2. Update custom fields.<br>3. Delete contact. | Data persists correctly in Neon Postgres. |
| **Dynamic Segments**| 1. Create segment with filter: `country == 'USA'`.<br>2. Add contact from USA. | Contact automatically appears in the segment. |
| **Import Flow** | 1. Upload CSV with 1,000 contacts.<br>2. Map columns to custom fields. | Contacts are imported in background; counts match. |
| **Activity Feed** | 1. Open an email sent to a contact.<br>2. View contact detail page. | "Email Opened" event appears in the timeline. |

### 2.3 Content & Forms
**Objective:** Verify creation of templates and lead capture mechanisms.

| Flow | Steps | Expected Outcome |
| :--- | :--- | :--- |
| **Email Template** | 1. Create template with `{{contact.name}}`.<br>2. Send test preview. | Variables are correctly substituted in the preview. |
| **Form Builder** | 1. Create form with Email and "Company" field.<br>2. Embed/View form. | Form renders with correct validation rules. |
| **Lead Capture** | 1. Submit form as a new visitor. | New contact created in CRM; attributed to the form. |
| **Asset Manager** | 1. Upload image to R2.<br>2. Insert into email template. | Image is accessible via CDN and renders in email. |

### 2.4 Campaigns (Batch)
**Objective:** Verify bulk message scheduling and delivery.

| Flow | Steps | Expected Outcome |
| :--- | :--- | :--- |
| **Scheduled Send** | 1. Create campaign for Segment A.<br>2. Schedule for 1 hour from now. | Campaign starts at correct time; messages enqueued. |
| **A/B Testing** | 1. Create 2 subject line variants.<br>2. Send to 20% of segment. | Winner automatically sent to the remaining 80%. |
| **Stats Tracking** | 1. Send campaign to 100 contacts.<br>2. Open 10 emails. | Dashboard shows 10% open rate in near real-time. |

### 2.5 Journeys (Automation)
**Objective:** Verify multi-step, event-driven automation logic.

| Flow | Steps | Expected Outcome |
| :--- | :--- | :--- |
| **Trigger Logic** | 1. Set trigger: "Form Submitted".<br>2. Action: "Send Welcome Email". | Contact receives email immediately after submission. |
| **Conditional Path**| 1. Condition: "Is Premium?".<br>2. Path A (Yes), Path B (No). | Contact follows the correct path based on attributes. |
| **Wait Steps** | 1. Delay action for 2 days. | Execution pauses; resumes correctly after 48 hours. |

### 2.6 Delivery & Providers
**Objective:** Verify the reliability of the delivery engine.

| Flow | Steps | Expected Outcome |
| :--- | :--- | :--- |
| **Provider Setup** | 1. Configure AWS SES credentials.<br>2. Verify domain via DNS. | Provider status changes to 'active'. |
| **Suppression** | 1. Try sending to a hard-bounced email. | Delivery engine blocks the send; logs suppression. |
| **Webhook Ingest** | 1. Send message via SendGrid.<br>2. Receive 'Delivered' webhook. | `DeliveryJob` status updates to 'delivered'. |

### 2.7 Billing & Quotas
**Objective:** Verify commercial limits and subscription lifecycle.

| Flow | Steps | Expected Outcome |
| :--- | :--- | :--- |
| **Upgrade Flow** | 1. Select 'Pro' plan.<br>2. Complete Stripe Checkout. | Organization limits (e.g. contact count) are increased. |
| **Quota Enforcement**| 1. Reach 1,000 contact limit on Free plan.<br>2. Attempt to add another. | Request rejected with "QUOTA_EXCEEDED" error. |
| **Usage Reset** | 1. Reach end of billing cycle. | Usage counters for emails sent reset to zero. |

---

## 3. Non-Functional Requirements (NFR) Tests

### 3.1 Multi-Tenancy (Data Isolation)
- **Test:** Authenticate as Org A, try to `GET /api/v1/crm/contacts/{orgB_contact_id}`.
- **Expected:** `404 Not Found` or `403 Forbidden`.
- **Test:** Verify global RLS policies on Postgres are applied to all tenant-scoped tables.

### 3.2 Performance & Scalability
- **Test:** Concurrent form submissions (100 req/sec).
- **Expected:** Gateway rate limiting kicks in or system processes via queues without 5xx.
- **Test:** Delivery of 100k emails in a single campaign.
- **Expected:** BullMQ workers scale horizontally; Fly.io metrics show healthy CPU/RAM.

### 3.3 Security
- **Test:** XSS injection in template subject lines.
- **Expected:** Sanitized on output/rendering.
- **Test:** CSRF attempt on password change.
- **Expected:** `403 Forbidden` due to missing/invalid CSRF token.

---

## 4. Test Environment Matrix

| Environment | Database | Workers | Background Services |
| :--- | :--- | :--- | :--- |
| **Local** | Docker Postgres | Miniflare / `wrangler dev` | Local Redis + `npm run dev` |
| **Staging** | Neon Branch | Preview Workers | Fly.io Staging Apps |
| **Production** | Neon Main | Production Workers | Fly.io Production Apps |

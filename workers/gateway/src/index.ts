import type { TenantContext } from '@mauntic/domain-kernel';
import type { Logger } from '@mauntic/worker-lib';
import { createApp } from './app.js';
import type { SessionUser, SessionOrganization } from './middleware/auth.js';

/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  Variables: {
    requestId: string;
    logger: Logger;
    user?: SessionUser;
    organization?: SessionOrganization;
    userId?: string; // UUID
    organizationId?: string; // UUID
    tenantContext?: TenantContext;
  };
  Bindings: {
    KV: KVNamespace;
    DB: Hyperdrive;
    APP_DOMAIN: string;
    RATE_LIMITER: DurableObjectNamespace;

    // Service Bindings
    IDENTITY: Fetcher;
    BILLING: Fetcher;
    CRM: Fetcher;
    JOURNEY: Fetcher;
    DELIVERY: Fetcher;
    CAMPAIGN: Fetcher;
    CONTENT: Fetcher;
    ANALYTICS: Fetcher;
    INTEGRATIONS: Fetcher;
    LEAD_INTELLIGENCE: Fetcher;
    SCORING: Fetcher;
    REVOPS: Fetcher;
  };
}

const app = createApp();

export default {
  fetch: app.fetch,
};

export { RateLimiter } from './rate-limiter.js';

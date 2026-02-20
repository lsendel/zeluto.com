import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';
import type { TenantContext } from '@mauntic/domain-kernel';
import type { Logger } from '@mauntic/worker-lib';
import { createApp } from './app.js';
import type { SessionOrganization, SessionUser } from './middleware/auth.js';

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
    tenantContextHeader?: string;
    tenantContextCacheKey?: string;
  };
  Bindings: {
    KV: KVNamespace;
    DB: Hyperdrive;
    APP_DOMAIN: string;
    STATIC_BASE_URL?: string;
    RATE_LIMITER: DurableObjectNamespace;
    TENANT_CACHE: DurableObjectNamespace;
    STATIC_ASSETS?: R2Bucket;
    LOGS_DATASET?: AnalyticsEngineDataset;

    // Service Bindings
    IDENTITY: Fetcher;
    IDENTITY_DISPATCH?: Fetcher;
    BILLING: Fetcher;
    BILLING_DISPATCH?: Fetcher;
    CRM: Fetcher;
    CRM_DISPATCH?: Fetcher;
    DELIVERY_DISPATCH?: Fetcher;
    JOURNEY: Fetcher;
    DELIVERY: Fetcher;
    CAMPAIGN: Fetcher;
    CONTENT: Fetcher;
    ANALYTICS: Fetcher;
    ANALYTICS_DISPATCH?: Fetcher;
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

export { TenantContextDurableObject } from '@mauntic/worker-lib';
export { RateLimiter } from './rate-limiter.js';

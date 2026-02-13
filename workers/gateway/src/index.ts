import type { TenantContext } from '@mauntic/domain-kernel';
import type { Logger } from '@mauntic/worker-lib';
import { createApp } from './app.js';
import type { SessionData } from './middleware/auth.js';

/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  Variables: {
    requestId: string;
    logger: Logger;
    user?: SessionData['user'];
    organization?: SessionData['organization'];
    userId?: number;
    organizationId?: number;
    tenantContext?: TenantContext;
  };
  Bindings: {
    KV: KVNamespace;
    DB: Hyperdrive;
    APP_DOMAIN: string;

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
  };
}

const app = createApp();

export default {
  fetch: app.fetch,
};

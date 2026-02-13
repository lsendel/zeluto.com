import type { TenantContext } from '@mauntic/domain-kernel';
import type { Logger } from '@mauntic/worker-lib';
import { createApp } from './app.js';

/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  Variables: {
    requestId: string;
    logger: Logger;
    tenantContext?: TenantContext;
  };
  Bindings: {
    KV: KVNamespace;
    DB: Hyperdrive;
  };
}

const app = createApp();

export default {
  fetch: app.fetch,
};

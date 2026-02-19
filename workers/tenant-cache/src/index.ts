import { TenantContextDurableObject } from '@mauntic/worker-lib';

export { TenantContextDurableObject };

export default {
  fetch(): Response {
    return new Response('mauntic-tenant-cache: Durable Object host only', { status: 200 });
  },
};

interface RateLimitPayload {
  category: string;
  bucket: string;
  limit: number;
}

interface RateLimitState {
  bucket: string;
  count: number;
}

export class RateLimiter {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const payload = (await request.json()) as Partial<RateLimitPayload>;
    if (!payload.category || !payload.bucket || !payload.limit) {
      return new Response('Bad Request', { status: 400 });
    }

    const key = payload.category;
    const existing = (await this.state.storage.get<RateLimitState>(key)) ?? {
      bucket: payload.bucket,
      count: 0,
    };

    const count = existing.bucket === payload.bucket ? existing.count : 0;

    if (count >= payload.limit) {
      return Response.json({ allowed: false, count });
    }

    const nextState: RateLimitState = {
      bucket: payload.bucket,
      count: count + 1,
    };
    await this.state.storage.put(key, nextState);

    return Response.json({ allowed: true, count: nextState.count });
  }
}

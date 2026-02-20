export interface ServiceBindingClientOptions {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
}

export class ServiceBindingClient {
  constructor(
    private readonly fetcher: Fetcher,
    private readonly options: ServiceBindingClientOptions,
  ) {}

  async request(path: string, init?: RequestInit): Promise<Response> {
    const url = new URL(path, this.options.baseUrl).toString();
    const headers = new Headers(this.options.defaultHeaders);
    if (init?.headers) {
      const provided = new Headers(init.headers as HeadersInit);
      provided.forEach((value, key) => {
        headers.set(key, value);
      });
    }
    const request = new Request(url, {
      ...init,
      headers,
    });
    return this.fetcher.fetch(request);
  }
}

export function createServiceBindingClient(
  fetcher: Fetcher,
  options: ServiceBindingClientOptions,
): ServiceBindingClient {
  return new ServiceBindingClient(fetcher, options);
}

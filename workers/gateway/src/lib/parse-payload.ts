/**
 * Generic payload parser — replaces parseOrganizationPayload, parseDeliveryDomainPayload,
 * parseDeliveryProviderTestPayload, parseDeliverySuppressionPayload.
 *
 * Reads from JSON body or form data depending on Content-Type, extracts only string fields
 * listed in `fields`.
 */
export async function parsePayload(
  c: {
    req: {
      header: (name: string) => string | undefined;
      json: () => Promise<unknown>;
      parseBody: () => Promise<Record<string, unknown>>;
    };
  },
  fields: string[],
): Promise<Record<string, string>> {
  const contentType = c.req.header('Content-Type') ?? '';
  let raw: Record<string, unknown>;

  if (contentType.includes('application/json')) {
    raw = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  } else {
    raw = (await c.req.parseBody()) as Record<string, unknown>;
  }

  const result: Record<string, string> = {};
  for (const field of fields) {
    const value = raw?.[field];
    if (typeof value === 'string') {
      result[field] = value;
    }
  }
  return result;
}

/**
 * Read the raw JSON body (clones the request so it can be read again).
 */
export async function parseJsonBody<T = Record<string, unknown>>(
  c: any,
): Promise<T | null> {
  const clone = c.req.raw.clone();
  return (await clone.json().catch(() => null)) as T | null;
}

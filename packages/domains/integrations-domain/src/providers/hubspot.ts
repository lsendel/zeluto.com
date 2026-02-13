import type { SyncProvider, SyncRecord, SyncResult } from './sync-provider.js';

interface HubSpotConfig {
  accessToken: string;
  portalId?: string;
}

function parseConfig(config: Record<string, unknown>): HubSpotConfig {
  return {
    accessToken: config.accessToken as string,
    portalId: config.portalId as string | undefined,
  };
}

const BASE_URL = 'https://api.hubapi.com';

const ENTITY_MAP: Record<string, string> = {
  contacts: 'contacts',
  companies: 'companies',
  deals: 'deals',
};

export class HubSpotProvider implements SyncProvider {
  readonly name = 'hubspot';

  async testConnection(config: Record<string, unknown>): Promise<{ success: boolean; message?: string }> {
    const { accessToken } = parseConfig(config);

    try {
      const response = await fetch(`${BASE_URL}/crm/v3/objects/contacts?limit=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        return { success: false, message: `HubSpot returned ${response.status}` };
      }

      return { success: true, message: 'Connected to HubSpot' };
    } catch (error) {
      return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  async pullRecords(
    config: Record<string, unknown>,
    entityType: string,
    since?: Date,
  ): Promise<SyncRecord[]> {
    const { accessToken } = parseConfig(config);
    const objectType = ENTITY_MAP[entityType] ?? entityType;

    const params = new URLSearchParams({ limit: '100' });
    if (since) {
      // HubSpot uses filter API for date ranges
      params.set('filterGroups', JSON.stringify([{
        filters: [{
          propertyName: 'lastmodifieddate',
          operator: 'GTE',
          value: since.getTime().toString(),
        }],
      }]));
    }

    try {
      const response = await fetch(
        `${BASE_URL}/crm/v3/objects/${objectType}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.ok) {
        throw new Error(`HubSpot query failed: ${response.status}`);
      }

      const result = (await response.json()) as { results: Array<{ id: string; properties: Record<string, unknown> }> };

      return (result.results ?? []).map((record) => ({
        externalId: record.id,
        data: record.properties,
      }));
    } catch (error) {
      throw new Error(`HubSpot pull failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async pushRecords(
    config: Record<string, unknown>,
    entityType: string,
    records: SyncRecord[],
  ): Promise<SyncResult> {
    const { accessToken } = parseConfig(config);
    const objectType = ENTITY_MAP[entityType] ?? entityType;

    let recordsSynced = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        const method = record.externalId ? 'PATCH' : 'POST';
        const url = record.externalId
          ? `${BASE_URL}/crm/v3/objects/${objectType}/${record.externalId}`
          : `${BASE_URL}/crm/v3/objects/${objectType}`;

        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties: record.data }),
        });

        if (response.ok || response.status === 201) {
          recordsSynced++;
        } else {
          const body = await response.text();
          errors.push(`Failed to sync record ${record.externalId ?? 'new'}: ${response.status} ${body}`);
        }
      } catch (error) {
        errors.push(`Error syncing record: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { success: errors.length === 0, recordsSynced, errors };
  }
}

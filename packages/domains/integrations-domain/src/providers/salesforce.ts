import type { SyncProvider, SyncRecord, SyncResult } from './sync-provider.js';

interface SalesforceConfig {
  instanceUrl: string;
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
}

function parseConfig(config: Record<string, unknown>): SalesforceConfig {
  return {
    instanceUrl: config.instanceUrl as string,
    accessToken: config.accessToken as string,
    refreshToken: config.refreshToken as string | undefined,
    clientId: config.clientId as string | undefined,
    clientSecret: config.clientSecret as string | undefined,
  };
}

const ENTITY_MAP: Record<string, string> = {
  contacts: 'Contact',
  companies: 'Account',
  deals: 'Opportunity',
  leads: 'Lead',
};

export class SalesforceProvider implements SyncProvider {
  readonly name = 'salesforce';

  async testConnection(config: Record<string, unknown>): Promise<{ success: boolean; message?: string }> {
    const { instanceUrl, accessToken } = parseConfig(config);

    try {
      const response = await fetch(`${instanceUrl}/services/data/v59.0/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        return { success: false, message: `Salesforce returned ${response.status}` };
      }

      return { success: true, message: 'Connected to Salesforce' };
    } catch (error) {
      return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  async pullRecords(
    config: Record<string, unknown>,
    entityType: string,
    since?: Date,
  ): Promise<SyncRecord[]> {
    const { instanceUrl, accessToken } = parseConfig(config);
    const sfObject = ENTITY_MAP[entityType] ?? entityType;

    let query = `SELECT Id, Name, Email, Phone, CreatedDate, LastModifiedDate FROM ${sfObject}`;
    if (since) {
      query += ` WHERE LastModifiedDate > ${since.toISOString()}`;
    }
    query += ' LIMIT 2000';

    try {
      const response = await fetch(
        `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.ok) {
        throw new Error(`Salesforce query failed: ${response.status}`);
      }

      const result = (await response.json()) as { records: Array<Record<string, unknown>> };

      return (result.records ?? []).map((record) => ({
        externalId: record.Id as string,
        data: record,
      }));
    } catch (error) {
      throw new Error(`Salesforce pull failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async pushRecords(
    config: Record<string, unknown>,
    entityType: string,
    records: SyncRecord[],
  ): Promise<SyncResult> {
    const { instanceUrl, accessToken } = parseConfig(config);
    const sfObject = ENTITY_MAP[entityType] ?? entityType;

    let recordsSynced = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        const method = record.externalId ? 'PATCH' : 'POST';
        const url = record.externalId
          ? `${instanceUrl}/services/data/v59.0/sobjects/${sfObject}/${record.externalId}`
          : `${instanceUrl}/services/data/v59.0/sobjects/${sfObject}`;

        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(record.data),
        });

        if (response.ok || response.status === 201 || response.status === 204) {
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

/**
 * Common interface that all CRM sync providers must implement.
 */
export interface SyncRecord {
  externalId: string;
  data: Record<string, unknown>;
}

export interface SyncResult {
  success: boolean;
  recordsSynced: number;
  errors: string[];
}

export interface SyncProvider {
  /** Provider name used in connection config */
  readonly name: string;

  /** Test connectivity with the configured credentials */
  testConnection(
    config: Record<string, unknown>,
  ): Promise<{ success: boolean; message?: string }>;

  /** Pull records from the external system (inbound) */
  pullRecords(
    config: Record<string, unknown>,
    entityType: string,
    since?: Date,
  ): Promise<SyncRecord[]>;

  /** Push records to the external system (outbound) */
  pushRecords(
    config: Record<string, unknown>,
    entityType: string,
    records: SyncRecord[],
  ): Promise<SyncResult>;
}

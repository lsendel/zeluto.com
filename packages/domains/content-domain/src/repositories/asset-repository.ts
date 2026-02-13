import type { Asset } from '../entities/asset.js';

export interface AssetRepository {
  findById(orgId: string, id: string): Promise<Asset | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number; folder?: string },
  ): Promise<{ data: Asset[]; total: number }>;
  save(asset: Asset): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
  listFolders(orgId: string): Promise<{ name: string; assetCount: number }[]>;
}

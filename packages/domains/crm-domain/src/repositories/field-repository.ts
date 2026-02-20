import type { OrganizationId } from '@mauntic/domain-kernel';
import type { Field, FieldEntityType } from '../entities/field.js';

export interface FieldRepository {
  findById(orgId: OrganizationId, id: string): Promise<Field | null>;
  findByOrganization(
    orgId: OrganizationId,
    entityType?: FieldEntityType,
  ): Promise<Field[]>;
  save(field: Field): Promise<void>;
  delete(orgId: OrganizationId, id: string): Promise<void>;
}

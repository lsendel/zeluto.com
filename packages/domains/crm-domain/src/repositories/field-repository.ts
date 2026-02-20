import type { Field, FieldEntityType } from '../entities/field.js';

export interface FieldRepository {
  findById(orgId: string, id: string): Promise<Field | null>;
  findByOrganization(
    orgId: string,
    entityType?: FieldEntityType,
  ): Promise<Field[]>;
  save(field: Field): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}

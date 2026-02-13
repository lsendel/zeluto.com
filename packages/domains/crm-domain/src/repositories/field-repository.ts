import type { Field } from '../entities/field.js';
import type { FieldEntityType } from '../entities/field.js';

export interface FieldRepository {
  findById(orgId: string, id: string): Promise<Field | null>;
  findByOrganization(
    orgId: string,
    entityType?: FieldEntityType,
  ): Promise<Field[]>;
  save(field: Field): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}

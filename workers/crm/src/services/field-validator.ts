import { fields } from '@mauntic/crm-domain/drizzle';
import { and, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldValidationResult {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate custom field values against field definitions stored in the
 * `fields` table for the given organization and entity type.
 *
 * - Checks that every provided key matches a defined field.
 * - Checks required fields are present.
 * - Validates value types against the field's `field_type`.
 * - Validates that select/multiselect values are among the allowed options.
 */
export async function validateCustomFields(
  db: NeonHttpDatabase,
  orgId: string,
  entityType: 'contact' | 'company',
  customFields: Record<string, unknown>,
): Promise<FieldValidationResult> {
  const errors: string[] = [];

  // Fetch all field definitions for this org + entity type
  const fieldDefs = await db
    .select()
    .from(fields)
    .where(
      and(
        eq(fields.organization_id, orgId),
        eq(fields.entity_type, entityType),
      ),
    );

  const defsByName = new Map(fieldDefs.map((f) => [f.name, f]));

  // Check for unknown fields
  for (const key of Object.keys(customFields)) {
    if (!defsByName.has(key)) {
      errors.push(`Unknown custom field: "${key}"`);
    }
  }

  // Check each defined field
  for (const def of fieldDefs) {
    const value = customFields[def.name];

    // Required check
    if (
      def.is_required &&
      (value === undefined || value === null || value === '')
    ) {
      errors.push(`Field "${def.label}" is required`);
      continue;
    }

    // Skip validation if value is not provided and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type-specific validation
    switch (def.field_type) {
      case 'text': {
        if (typeof value !== 'string') {
          errors.push(`Field "${def.label}" must be a text value`);
        }
        break;
      }

      case 'number': {
        if (typeof value !== 'number' && Number.isNaN(Number(value))) {
          errors.push(`Field "${def.label}" must be a numeric value`);
        }
        break;
      }

      case 'date': {
        const d = new Date(String(value));
        if (Number.isNaN(d.getTime())) {
          errors.push(`Field "${def.label}" must be a valid date`);
        }
        break;
      }

      case 'select': {
        const opts = Array.isArray(def.options)
          ? (def.options as string[])
          : [];
        if (typeof value !== 'string' || !opts.includes(value)) {
          errors.push(
            `Field "${def.label}" must be one of: ${opts.join(', ')}`,
          );
        }
        break;
      }

      case 'multiselect': {
        const opts = Array.isArray(def.options)
          ? (def.options as string[])
          : [];
        if (!Array.isArray(value)) {
          errors.push(`Field "${def.label}" must be an array of values`);
        } else {
          for (const v of value) {
            if (typeof v !== 'string' || !opts.includes(v)) {
              errors.push(
                `Field "${def.label}" contains invalid option "${v}". Allowed: ${opts.join(', ')}`,
              );
            }
          }
        }
        break;
      }

      default:
        // Unknown field type -- skip validation
        break;
    }
  }

  return { valid: errors.length === 0, errors };
}

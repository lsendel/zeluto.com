import { z } from 'zod';
import type { Column } from 'drizzle-orm';
import { sql, and, or, eq, ne, gt, lt, gte, lte, like, notLike, inArray, notInArray, isNotNull, isNull, type SQL } from 'drizzle-orm';
import type { Contact } from '../entities/contact.js';
import { contacts } from '../../drizzle/schema.js';

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export const FilterOperatorSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'lt',
  'gte',
  'lte',
  'contains',
  'not_contains',
  'starts_with',
  'in',
  'not_in',
  'is_set',
  'is_not_set',
]);

export type FilterOperator = z.infer<typeof FilterOperatorSchema>;

export const FilterConditionSchema = z.object({
  field: z.string(),
  operator: FilterOperatorSchema,
  value: z.unknown(),
});

export type FilterCondition = z.infer<typeof FilterConditionSchema>;

export const FilterCriteriaSchema = z.object({
  operator: z.enum(['and', 'or']),
  conditions: z.array(FilterConditionSchema),
});

export type FilterCriteria = z.infer<typeof FilterCriteriaSchema>;

// ---------------------------------------------------------------------------
// In-memory evaluation (pure domain logic)
// ---------------------------------------------------------------------------

function getContactFieldValue(contact: Contact, field: string): unknown {
  switch (field) {
    case 'email':
      return contact.email;
    case 'firstName':
      return contact.firstName;
    case 'lastName':
      return contact.lastName;
    case 'phone':
      return contact.phone;
    case 'status':
      return contact.status;
    case 'companyId':
      return contact.companyId;
    case 'lastActivityAt':
      return contact.lastActivityAt;
    case 'createdAt':
      return contact.createdAt;
    case 'updatedAt':
      return contact.updatedAt;
    default:
      // Look in custom fields
      return contact.customFields[field];
  }
}

function evaluateCondition(contact: Contact, condition: FilterCondition): boolean {
  const fieldValue = getContactFieldValue(contact, condition.field);
  const conditionValue = condition.value;

  switch (condition.operator) {
    case 'eq':
      return fieldValue === conditionValue;
    case 'neq':
      return fieldValue !== conditionValue;
    case 'gt':
      return fieldValue != null && conditionValue != null && (fieldValue as number) > (conditionValue as number);
    case 'lt':
      return fieldValue != null && conditionValue != null && (fieldValue as number) < (conditionValue as number);
    case 'gte':
      return fieldValue != null && conditionValue != null && (fieldValue as number) >= (conditionValue as number);
    case 'lte':
      return fieldValue != null && conditionValue != null && (fieldValue as number) <= (conditionValue as number);
    case 'contains':
      return typeof fieldValue === 'string' && typeof conditionValue === 'string' && fieldValue.toLowerCase().includes(conditionValue.toLowerCase());
    case 'not_contains':
      return typeof fieldValue === 'string' && typeof conditionValue === 'string' && !fieldValue.toLowerCase().includes(conditionValue.toLowerCase());
    case 'starts_with':
      return typeof fieldValue === 'string' && typeof conditionValue === 'string' && fieldValue.toLowerCase().startsWith(conditionValue.toLowerCase());
    case 'in':
      return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
    case 'not_in':
      return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
    case 'is_set':
      return fieldValue != null && fieldValue !== '';
    case 'is_not_set':
      return fieldValue == null || fieldValue === '';
    default:
      return false;
  }
}

/**
 * Evaluate a set of filter criteria against a contact entity in-memory.
 * Used for dynamic segment membership checks without hitting the database.
 */
export function evaluateFilter(contact: Contact, criteria: FilterCriteria): boolean {
  const parsed = FilterCriteriaSchema.parse(criteria);

  if (parsed.conditions.length === 0) {
    return true;
  }

  if (parsed.operator === 'and') {
    return parsed.conditions.every((condition) => evaluateCondition(contact, condition));
  }

  return parsed.conditions.some((condition) => evaluateCondition(contact, condition));
}

// ---------------------------------------------------------------------------
// Drizzle SQL builder
// ---------------------------------------------------------------------------

/** Map of known contact fields to their Drizzle column references. */
function getColumn(field: string): Column | null {
  switch (field) {
    case 'email':
      return contacts.email;
    case 'first_name':
      return contacts.first_name;
    case 'last_name':
      return contacts.last_name;
    case 'phone':
      return contacts.phone;
    case 'status':
      return contacts.status;
    default:
      return null;
  }
}

function buildConditionSQL(condition: FilterCondition): SQL | null {
  const { field, operator, value } = condition;

  // For known columns, use typed references; for custom fields, use jsonb extraction
  const column = getColumn(field);

  if (column) {
    switch (operator) {
      case 'eq':
        return eq(column, value as string);
      case 'neq':
        return ne(column, value as string);
      case 'gt':
        return gt(column, value as string);
      case 'lt':
        return lt(column, value as string);
      case 'gte':
        return gte(column, value as string);
      case 'lte':
        return lte(column, value as string);
      case 'contains':
        return like(column, `%${value}%`);
      case 'not_contains':
        return notLike(column, `%${value}%`);
      case 'starts_with':
        return like(column, `${value}%`);
      case 'in':
        return Array.isArray(value) ? inArray(column, value) : null;
      case 'not_in':
        return Array.isArray(value) ? notInArray(column, value) : null;
      case 'is_set':
        return isNotNull(column);
      case 'is_not_set':
        return isNull(column);
      default:
        return null;
    }
  }

  // Custom field: use jsonb extraction
  const jsonPath = sql`custom_fields->>${field}`;
  switch (operator) {
    case 'eq':
      return sql`${jsonPath} = ${value as string}`;
    case 'neq':
      return sql`${jsonPath} != ${value as string}`;
    case 'gt':
      return sql`${jsonPath} > ${value as string}`;
    case 'lt':
      return sql`${jsonPath} < ${value as string}`;
    case 'gte':
      return sql`${jsonPath} >= ${value as string}`;
    case 'lte':
      return sql`${jsonPath} <= ${value as string}`;
    case 'contains':
      return sql`${jsonPath} ILIKE ${'%' + (value as string) + '%'}`;
    case 'not_contains':
      return sql`${jsonPath} NOT ILIKE ${'%' + (value as string) + '%'}`;
    case 'starts_with':
      return sql`${jsonPath} ILIKE ${(value as string) + '%'}`;
    case 'is_set':
      return sql`${jsonPath} IS NOT NULL`;
    case 'is_not_set':
      return sql`${jsonPath} IS NULL`;
    default:
      return null;
  }
}

/**
 * Build a Drizzle SQL `where` clause from filter criteria for the contacts table.
 * Includes organization_id scoping automatically.
 */
export function buildDrizzleWhere(criteria: FilterCriteria, orgId: string): SQL {
  const parsed = FilterCriteriaSchema.parse(criteria);
  const orgFilter = eq(contacts.organization_id, orgId);

  if (parsed.conditions.length === 0) {
    return orgFilter;
  }

  const conditionSQLs = parsed.conditions
    .map((c) => buildConditionSQL(c))
    .filter((s): s is SQL => s !== null);

  if (conditionSQLs.length === 0) {
    return orgFilter;
  }

  const combined =
    parsed.operator === 'and'
      ? and(...conditionSQLs)
      : or(...conditionSQLs);

  return combined ? and(orgFilter, combined)! : orgFilter;
}

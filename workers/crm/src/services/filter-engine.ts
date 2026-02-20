import { contacts } from '@mauntic/crm-domain/drizzle';
import { and, eq, inArray, notInArray, or, type SQL, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterCriteria {
  operator: 'and' | 'or';
  conditions: FilterCondition[];
}

export interface FilterCondition {
  /** Column name on contacts table or a custom field key */
  field: string;
  /**
   * Comparison operator:
   *   eq, neq, gt, lt, gte, lte,
   *   contains, not_contains, starts_with, ends_with,
   *   in, not_in, is_set, is_not_set
   */
  operator: string;
  /** Comparison value (ignored for is_set / is_not_set) */
  value?: unknown;
}

// ---------------------------------------------------------------------------
// Column resolution
// ---------------------------------------------------------------------------

/** Known contact columns that can be referenced in filter conditions. */
const COLUMN_MAP: Record<string, SQL | undefined> = {
  email: sql.raw(`"email"`),
  first_name: sql.raw(`"first_name"`),
  last_name: sql.raw(`"last_name"`),
  phone: sql.raw(`"phone"`),
  status: sql.raw(`"status"`),
  stage: sql.raw(`"stage"`),
  created_at: sql.raw(`"created_at"`),
  updated_at: sql.raw(`"updated_at"`),
  last_activity_at: sql.raw(`"last_activity_at"`),
};

/**
 * Resolve a field name to a Drizzle SQL expression.
 * Known columns map directly; everything else is treated as a JSONB
 * key inside `custom_fields`.
 */
function getContactColumn(field: string): SQL {
  const known = COLUMN_MAP[field];
  if (known) return known;

  // Custom field: access via jsonb ->> operator
  return sql`${contacts.custom_fields}->>${sql.raw(`'${field}'`)}`;
}

// ---------------------------------------------------------------------------
// Condition builder
// ---------------------------------------------------------------------------

function buildCondition(cond: FilterCondition): SQL | undefined {
  const column = getContactColumn(cond.field);
  const value = cond.value;

  switch (cond.operator) {
    case 'eq':
      return sql`${column} = ${value}`;

    case 'neq':
      return sql`${column} != ${value}`;

    case 'gt':
      return sql`${column} > ${value}`;

    case 'lt':
      return sql`${column} < ${value}`;

    case 'gte':
      return sql`${column} >= ${value}`;

    case 'lte':
      return sql`${column} <= ${value}`;

    case 'contains':
      return sql`${column} ILIKE ${`%${String(value)}%`}`;

    case 'not_contains':
      return sql`${column} NOT ILIKE ${`%${String(value)}%`}`;

    case 'starts_with':
      return sql`${column} ILIKE ${`${String(value)}%`}`;

    case 'ends_with':
      return sql`${column} ILIKE ${`%${String(value)}`}`;

    case 'in':
      if (Array.isArray(value) && value.length > 0) {
        return inArray(column, value as string[]);
      }
      return undefined;

    case 'not_in':
      if (Array.isArray(value) && value.length > 0) {
        return notInArray(column, value as string[]);
      }
      return undefined;

    case 'is_set':
      return sql`${column} IS NOT NULL`;

    case 'is_not_set':
      return sql`${column} IS NULL`;

    default:
      // Unknown operator -- skip silently so a single bad rule doesn't
      // crash the whole filter.
      console.warn(`Unknown filter operator: ${cond.operator}`);
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a Drizzle WHERE clause from segment filter criteria.
 *
 * The resulting expression always includes `organization_id = orgId`
 * so callers never accidentally leak data across organizations.
 */
export function buildFilterWhere(criteria: FilterCriteria, orgId: string): SQL {
  const orgFilter = eq(contacts.organization_id, orgId);

  if (!criteria.conditions || criteria.conditions.length === 0) {
    return orgFilter;
  }

  const conditions = criteria.conditions
    .map(buildCondition)
    .filter((c): c is SQL => c !== undefined);

  if (conditions.length === 0) {
    return orgFilter;
  }

  const combined =
    criteria.operator === 'or' ? or(...conditions)! : and(...conditions)!;

  return and(orgFilter, combined)!;
}

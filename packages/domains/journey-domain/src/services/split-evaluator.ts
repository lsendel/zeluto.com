/**
 * Pure domain logic for evaluating journey splits.
 * No side effects, no I/O -- suitable for unit testing.
 */

/**
 * Random split: weighted random selection based on percentages.
 * Returns the label of the selected branch.
 */
export function evaluateRandomSplit(
  branches: Array<{ label: string; percentage: number }>,
): string {
  if (branches.length === 0) {
    throw new Error('Cannot evaluate random split with no branches');
  }

  const totalPercentage = branches.reduce((sum, b) => sum + b.percentage, 0);

  // Generate a random value between 0 and totalPercentage
  const random = Math.random() * totalPercentage;

  let cumulative = 0;
  for (const branch of branches) {
    cumulative += branch.percentage;
    if (random < cumulative) {
      return branch.label;
    }
  }

  // Fallback to last branch (handles floating-point edge cases)
  return branches[branches.length - 1].label;
}

/**
 * Condition split: evaluate a field condition against contact data.
 * Returns true if the condition is met.
 */
export function evaluateConditionSplit(
  field: string,
  operator: string,
  value: unknown,
  contactData: Record<string, unknown>,
): boolean {
  const fieldValue = getNestedValue(contactData, field);

  switch (operator) {
    case 'eq':
    case 'equals':
      return fieldValue === value;

    case 'neq':
    case 'not_equals':
      return fieldValue !== value;

    case 'gt':
    case 'greater_than':
      return (
        typeof fieldValue === 'number' &&
        typeof value === 'number' &&
        fieldValue > value
      );

    case 'gte':
    case 'greater_than_or_equals':
      return (
        typeof fieldValue === 'number' &&
        typeof value === 'number' &&
        fieldValue >= value
      );

    case 'lt':
    case 'less_than':
      return (
        typeof fieldValue === 'number' &&
        typeof value === 'number' &&
        fieldValue < value
      );

    case 'lte':
    case 'less_than_or_equals':
      return (
        typeof fieldValue === 'number' &&
        typeof value === 'number' &&
        fieldValue <= value
      );

    case 'contains':
      return (
        typeof fieldValue === 'string' &&
        typeof value === 'string' &&
        fieldValue.includes(value)
      );

    case 'not_contains':
      return (
        typeof fieldValue === 'string' &&
        typeof value === 'string' &&
        !fieldValue.includes(value)
      );

    case 'starts_with':
      return (
        typeof fieldValue === 'string' &&
        typeof value === 'string' &&
        fieldValue.startsWith(value)
      );

    case 'ends_with':
      return (
        typeof fieldValue === 'string' &&
        typeof value === 'string' &&
        fieldValue.endsWith(value)
      );

    case 'is_set':
      return fieldValue !== null && fieldValue !== undefined;

    case 'is_not_set':
      return fieldValue === null || fieldValue === undefined;

    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);

    case 'not_in':
      return Array.isArray(value) && !value.includes(fieldValue);

    default:
      return false;
  }
}

/**
 * Resolve a dotted field path to a value in a nested object.
 * e.g., "address.city" from { address: { city: "NYC" } } => "NYC"
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object'
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

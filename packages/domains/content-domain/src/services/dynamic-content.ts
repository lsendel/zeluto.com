/**
 * Dynamic content engine for evaluating content variants
 * and personalizing templates with contact attributes.
 *
 * Supports:
 * - Personalization tokens: {{contact.firstName}}, {{contact.company}}, etc.
 * - Conditional variant blocks: {{#variant segment="premium"}}...{{/variant}}
 * - Fallback values: {{contact.firstName|"there"}}
 */

export interface ContactAttributes {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  [key: string]: unknown;
}

export interface VariantContext {
  contact: ContactAttributes;
  segments: string[];
  tags: string[];
  customData?: Record<string, unknown>;
}

/**
 * Replace personalization tokens in content with contact attribute values.
 *
 * Tokens supported:
 *   {{contact.firstName}}       - direct field
 *   {{contact.firstName|"there"}} - with fallback
 *   {{custom.someField}}        - custom data access
 */
export function personalizeContent(
  content: string,
  context: VariantContext,
): string {
  // Replace {{contact.<field>}} and {{contact.<field>|"fallback"}}
  let result = content.replace(
    /\{\{contact\.(\w+)(?:\|"([^"]*)")?\}\}/g,
    (_match, field: string, fallback?: string) => {
      const value = context.contact[field];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
      return fallback ?? '';
    },
  );

  // Replace {{custom.<field>}} tokens
  result = result.replace(
    /\{\{custom\.(\w+)(?:\|"([^"]*)")?\}\}/g,
    (_match, field: string, fallback?: string) => {
      const value = context.customData?.[field];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
      return fallback ?? '';
    },
  );

  return result;
}

/**
 * Evaluate variant blocks based on contact segments/tags.
 *
 * Syntax:
 *   {{#variant segment="premium"}}Premium content here{{/variant}}
 *   {{#variant tag="vip"}}VIP content here{{/variant}}
 *   {{#variant default="true"}}Default content here{{/variant}}
 *
 * Multiple variant blocks can exist; matching ones are included,
 * non-matching ones are removed.
 */
export function evaluateVariants(
  content: string,
  context: VariantContext,
): string {
  // Process segment-based variants
  let result = content.replace(
    /\{\{#variant\s+segment="([^"]+)"\}\}([\s\S]*?)\{\{\/variant\}\}/g,
    (_match, segment: string, blockContent: string) => {
      if (context.segments.includes(segment)) {
        return blockContent;
      }
      return '';
    },
  );

  // Process tag-based variants
  result = result.replace(
    /\{\{#variant\s+tag="([^"]+)"\}\}([\s\S]*?)\{\{\/variant\}\}/g,
    (_match, tag: string, blockContent: string) => {
      if (context.tags.includes(tag)) {
        return blockContent;
      }
      return '';
    },
  );

  // Process default variants (always included)
  result = result.replace(
    /\{\{#variant\s+default="true"\}\}([\s\S]*?)\{\{\/variant\}\}/g,
    (_match, blockContent: string) => {
      return blockContent;
    },
  );

  return result;
}

/**
 * Full content rendering pipeline:
 * 1. Evaluate conditional variant blocks
 * 2. Replace personalization tokens
 */
export function renderDynamicContent(
  content: string,
  context: VariantContext,
): string {
  const withVariants = evaluateVariants(content, context);
  return personalizeContent(withVariants, context);
}

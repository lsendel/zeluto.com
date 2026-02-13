/**
 * Simple Handlebars-like template rendering engine.
 * Supports {{variable}} interpolation, {{#if}}...{{/if}}, and {{#each}}...{{/each}}.
 * No external dependencies.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

/**
 * Resolve a dotted path (e.g. "contact.name") against a data object.
 */
function resolve(path: string, data: Record<string, unknown>): unknown {
  const parts = path.trim().split('.');
  let current: unknown = data;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isTruthy(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Process {{#each items}}...{{/each}} blocks.
 * Inside the block, {{this}} refers to the current item,
 * and {{@index}} refers to the current 0-based index.
 * Dot-path access on items is supported via {{this.property}}.
 */
function processEach(template: string, data: Record<string, unknown>): string {
  const eachRegex = /\{\{#each\s+(\S+?)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  return template.replace(eachRegex, (_match, key: string, body: string) => {
    const items = resolve(key, data);
    if (!Array.isArray(items)) return '';
    return items
      .map((item, index) => {
        // Create a child context with the item data
        const childData: Record<string, unknown> =
          typeof item === 'object' && item !== null
            ? { ...data, ...item, this: item, '@index': index }
            : { ...data, this: item, '@index': index };
        // First recursively process any nested blocks in the child context
        let rendered = processEach(body, childData);
        rendered = processConditionals(rendered, childData);
        rendered = interpolate(rendered, childData);
        return rendered;
      })
      .join('');
  });
}

/**
 * Process {{#if condition}}...{{else}}...{{/if}} blocks.
 * Supports optional {{else}} clause.
 */
function processConditionals(template: string, data: Record<string, unknown>): string {
  const ifRegex = /\{\{#if\s+(\S+?)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  return template.replace(ifRegex, (_match, key: string, body: string) => {
    const value = resolve(key, data);
    const parts = body.split(/\{\{else\}\}/);
    const trueBranch = parts[0] ?? '';
    const falseBranch = parts[1] ?? '';

    const branch = isTruthy(value) ? trueBranch : falseBranch;
    // Recursively process nested blocks
    let rendered = processEach(branch, data);
    rendered = processConditionals(rendered, data);
    rendered = interpolate(rendered, data);
    return rendered;
  });
}

/**
 * Interpolate {{variable}} placeholders.
 * Use {{{variable}}} for raw (unescaped) output.
 */
function interpolate(template: string, data: Record<string, unknown>): string {
  // Triple-brace: raw output (no HTML escaping)
  let result = template.replace(/\{\{\{(\S+?)\}\}\}/g, (_match, key: string) => {
    const value = resolve(key, data);
    return value == null ? '' : String(value);
  });

  // Double-brace: escaped output
  result = result.replace(/\{\{(\S+?)\}\}/g, (_match, key: string) => {
    const value = resolve(key, data);
    return value == null ? '' : escapeHtml(String(value));
  });

  return result;
}

/**
 * Render a template string with the given data context.
 *
 * Supported syntax:
 * - `{{variable}}` - Interpolate and HTML-escape a value
 * - `{{{variable}}}` - Interpolate without escaping (raw)
 * - `{{nested.path}}` - Dot-notation access
 * - `{{#if condition}}...{{else}}...{{/if}}` - Conditionals
 * - `{{#each items}}...{{/each}}` - Iteration (`{{this}}`, `{{@index}}`)
 *
 * @param template - The template string
 * @param data - Data context for variable resolution
 * @returns Rendered HTML string
 */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  let result = template;
  result = processEach(result, data);
  result = processConditionals(result, data);
  result = interpolate(result, data);
  return result;
}

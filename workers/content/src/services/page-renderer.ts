/**
 * HTML sanitization for landing page content.
 * Removes potentially dangerous elements while preserving safe HTML.
 */

// Tags that are always allowed
const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'address', 'article', 'aside', 'b', 'blockquote', 'br',
  'caption', 'cite', 'code', 'col', 'colgroup', 'dd', 'del', 'details',
  'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img',
  'ins', 'kbd', 'li', 'main', 'mark', 'nav', 'ol', 'p', 'picture',
  'pre', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'section', 'small',
  'source', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody',
  'td', 'tfoot', 'th', 'thead', 'time', 'tr', 'u', 'ul', 'var', 'video',
  'wbr', 'form', 'input', 'select', 'option', 'textarea', 'button', 'label',
  'fieldset', 'legend',
]);

// Attributes that are dangerous (event handlers)
const EVENT_HANDLER_PATTERN = /^on\w+$/i;

// Dangerous URL schemes
const DANGEROUS_URL_PATTERN = /^\s*(javascript|vbscript|data):/i;

/**
 * Sanitize HTML content by removing dangerous elements and attributes.
 *
 * Removes:
 * - <script> tags and their contents
 * - on* event handler attributes (onclick, onload, etc.)
 * - javascript: URLs
 * - <iframe>, <object>, <embed>, <applet> tags
 * - <style> tags (to prevent CSS-based attacks)
 * - <base> tags (to prevent URL hijacking)
 * - <meta> tags with http-equiv (to prevent redirects)
 */
export function sanitizeHtml(html: string): string {
  let sanitized = html;

  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove noscript tags and their content
  sanitized = sanitized.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

  // Remove style tags and their content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove iframe, object, embed, applet, base tags
  sanitized = sanitized.replace(/<\/?(?:iframe|object|embed|applet|base)\b[^>]*>/gi, '');

  // Remove meta tags with http-equiv
  sanitized = sanitized.replace(/<meta\b[^>]*http-equiv[^>]*>/gi, '');

  // Remove event handler attributes (on*)
  sanitized = sanitized.replace(
    /(<[^>]*)\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi,
    '$1',
  );

  // Remove javascript: URLs in href and src attributes
  sanitized = sanitized.replace(
    /(href|src|action)\s*=\s*(?:"[^"]*javascript:[^"]*"|'[^']*javascript:[^']*')/gi,
    '$1=""',
  );

  // Remove vbscript: URLs
  sanitized = sanitized.replace(
    /(href|src|action)\s*=\s*(?:"[^"]*vbscript:[^"]*"|'[^']*vbscript:[^']*')/gi,
    '$1=""',
  );

  // Remove data: URLs in src attributes (can be used for XSS)
  sanitized = sanitized.replace(
    /src\s*=\s*(?:"[^"]*data:[^"]*"|'[^']*data:[^']*')/gi,
    'src=""',
  );

  return sanitized;
}

/**
 * Wrap content in a basic HTML page structure for landing page rendering.
 */
export function wrapInHtmlPage(content: string, opts: {
  title: string;
  metaDescription?: string | null;
}): string {
  const metaDesc = opts.metaDescription
    ? `<meta name="description" content="${escapeAttr(opts.metaDescription)}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
  ${metaDesc}
</head>
<body>
${content}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

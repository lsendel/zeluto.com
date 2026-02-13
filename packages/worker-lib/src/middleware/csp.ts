import type { MiddlewareHandler } from 'hono';

export interface CspOptions {
  /** Additional script-src directives (e.g., CDN hosts for HTMX) */
  scriptSrc?: string[];
  /** Additional style-src directives */
  styleSrc?: string[];
  /** Additional img-src directives */
  imgSrc?: string[];
  /** Additional connect-src directives (e.g., API hosts, WebSocket) */
  connectSrc?: string[];
  /** Additional font-src directives */
  fontSrc?: string[];
  /** Whether to allow HTMX inline styles ('unsafe-inline' in style-src) */
  allowInlineStyles?: boolean;
  /** frame-ancestors value (default: 'none') */
  frameAncestors?: string;
  /** Report-only mode for testing (default: false) */
  reportOnly?: boolean;
  /** CSP report-uri for violation reporting */
  reportUri?: string;
}

/**
 * Content Security Policy middleware.
 *
 * Sets CSP and related security headers on all responses.
 * Configured with sensible defaults for an HTMX + Hono app.
 */
export function cspMiddleware(options?: CspOptions): MiddlewareHandler {
  const opts = options ?? {};

  const scriptSrc = ["'self'", ...(opts.scriptSrc ?? [])].join(' ');
  const styleSrc = [
    "'self'",
    ...(opts.allowInlineStyles !== false ? ["'unsafe-inline'"] : []),
    ...(opts.styleSrc ?? []),
  ].join(' ');
  const imgSrc = ["'self'", 'data:', 'https:', ...(opts.imgSrc ?? [])].join(' ');
  const fontSrc = ["'self'", ...(opts.fontSrc ?? [])].join(' ');
  const connectSrc = opts.connectSrc?.length
    ? ["'self'", ...opts.connectSrc].join(' ')
    : "'self'";
  const frameAncestors = opts.frameAncestors ?? "'none'";

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `img-src ${imgSrc}`,
    `font-src ${fontSrc}`,
    `connect-src ${connectSrc}`,
    `frame-ancestors ${frameAncestors}`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ];

  if (opts.reportUri) {
    directives.push(`report-uri ${opts.reportUri}`);
  }

  const cspValue = directives.join('; ');
  const cspHeader = opts.reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';

  return async (c, next) => {
    await next();

    c.header(cspHeader, cspValue);
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  };
}

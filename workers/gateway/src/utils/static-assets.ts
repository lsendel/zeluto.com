import type { Env } from '../index.js';

export function getStaticBaseUrl(env: Env['Bindings']): string {
  const value = env.STATIC_BASE_URL?.trim();
  return value && value.length > 0 ? value : '/assets';
}

export function getAssetContentType(key: string): string {
  if (key.endsWith('.css')) return 'text/css; charset=utf-8';
  if (key.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (key.endsWith('.json')) return 'application/json; charset=utf-8';
  if (key.endsWith('.svg')) return 'image/svg+xml';
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg';
  if (key.endsWith('.gif')) return 'image/gif';
  if (key.endsWith('.webp')) return 'image/webp';
  if (key.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

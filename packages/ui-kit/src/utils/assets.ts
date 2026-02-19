export function resolveAssetUrl(baseUrl: string | undefined, assetPath: string): string {
  const normalizedBase = baseUrl ? baseUrl.replace(/\/$/, '') : '';
  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return `${normalizedBase}${normalizedPath}`;
}

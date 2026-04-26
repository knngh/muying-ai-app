const SENSITIVE_QUERY_KEYS = new Set([
  'access_token',
  'code',
  'email',
  'password',
  'phone',
  'refresh_token',
  'secret',
  'token',
]);

function isSensitiveQueryKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_QUERY_KEYS.has(normalized)
    || normalized.includes('token')
    || normalized.includes('password')
    || normalized.includes('secret');
}

export function maskSensitiveUrl(rawUrl: string | undefined): string {
  if (!rawUrl) {
    return '';
  }

  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (isSensitiveQueryKey(key)) {
        parsed.searchParams.set(key, '[redacted]');
      }
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return rawUrl.replace(
      /([?&][^=]*(?:token|password|secret|phone|email|code)[^=]*=)[^&]*/gi,
      '$1[redacted]',
    );
  }
}

export interface AuthorityIdentityRecord {
  id?: string | null;
  source_id?: string | null;
  source_url?: string | null;
  url?: string | null;
  original_id?: string | null;
  question?: string | null;
}

export function normalizeAuthorityIdentitySourceId(sourceId?: string | null): string {
  return (sourceId || 'source')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'source';
}

export function normalizeAuthorityIdentityUrl(sourceUrl?: string | null): string {
  const trimmed = (sourceUrl || '').trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    if ((parsed.protocol === 'https:' && parsed.port === '443')
      || (parsed.protocol === 'http:' && parsed.port === '80')) {
      parsed.port = '';
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/g, '') || '/';
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return trimmed.toLowerCase().replace(/#.*$/g, '');
  }
}

export function hashAuthorityIdentity(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildStableAuthorityId(
  sourceId?: string | null,
  sourceUrl?: string | null,
  fallbackSeed?: string | number | null,
): string {
  const normalizedSourceId = normalizeAuthorityIdentitySourceId(sourceId);
  const normalizedUrl = normalizeAuthorityIdentityUrl(sourceUrl);
  const identitySeed = normalizedUrl || String(fallbackSeed || normalizedSourceId);

  return `authority-${normalizedSourceId}-${hashAuthorityIdentity(`${normalizedSourceId}:${identitySeed}`)}`;
}

export function buildLegacyAuthoritySlug(record: AuthorityIdentityRecord, index: number): string {
  const base = (record.id || record.original_id || record.question || `authority-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return base.startsWith('authority-') ? base : `authority-${base || index + 1}`;
}

export function buildStableAuthoritySlug(record: AuthorityIdentityRecord, index: number): string {
  const sourceUrl = record.source_url || record.url || record.original_id;
  if (!record.source_id || !sourceUrl) {
    return buildLegacyAuthoritySlug(record, index);
  }

  const base = buildStableAuthorityId(record.source_id, sourceUrl, index + 1);

  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.startsWith('authority-') ? slug : `authority-${slug || index + 1}`;
}

export function buildAuthoritySlugCandidates(record: AuthorityIdentityRecord, index: number): string[] {
  return Array.from(new Set([
    buildStableAuthoritySlug(record, index),
    buildLegacyAuthoritySlug(record, index),
  ]));
}

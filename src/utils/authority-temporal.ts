export type AuthorityUpdatedAtSource =
  | 'article_published_time'
  | 'article_modified_time'
  | 'schema_date_published'
  | 'schema_date_modified'
  | 'page_last_modified_meta'
  | 'http_last_modified';

interface AuthorityTemporalInput {
  sourceId?: string;
  sourceOrg?: string;
  sourceUrl?: string;
  updatedAt?: Date | string | null;
  fetchedAt?: Date | string | null;
  collectedAt?: Date | string | null;
  updatedAtSource?: string | null;
}

const FETCH_TIMESTAMP_UPDATED_AT_WINDOW_MS = 15 * 60 * 1000;
const VOLATILE_SOURCE_FETCH_WINDOW_MS = 36 * 60 * 60 * 1000;
const VOLATILE_UPDATED_AT_SOURCE_IDS = new Set([
  'aap',
  'mayo-clinic-zh',
  'who',
]);
const RELIABLE_UPDATED_AT_SOURCES = new Set<string>([
  'article_published_time',
  'article_modified_time',
  'schema_date_published',
  'schema_date_modified',
]);
const UNRELIABLE_UPDATED_AT_SOURCES = new Set<string>([
  'page_last_modified_meta',
  'http_last_modified',
]);

export function parseAuthorityTemporalDate(value?: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeAuthoritySourceId(input: AuthorityTemporalInput): string {
  const sourceText = [
    input.sourceId,
    input.sourceOrg,
    input.sourceUrl,
  ].filter(Boolean).join(' ').toLowerCase();

  if (/\baap\b|healthychildren\.org/.test(sourceText)) {
    return 'aap';
  }

  if (/mayo|mayoclinic\.org/.test(sourceText)) {
    return 'mayo-clinic-zh';
  }

  if (/\bwho\b|who\.int|世界卫生组织/.test(sourceText)) {
    return 'who';
  }

  return (input.sourceId || '').toLowerCase();
}

export function resolveReliableAuthorityUpdatedAt(input: AuthorityTemporalInput): Date | null {
  const updatedAt = parseAuthorityTemporalDate(input.updatedAt);
  if (!updatedAt) {
    return null;
  }

  const updatedAtSource = typeof input.updatedAtSource === 'string'
    ? input.updatedAtSource.trim().toLowerCase()
    : '';
  if (RELIABLE_UPDATED_AT_SOURCES.has(updatedAtSource)) {
    return updatedAt;
  }
  if (UNRELIABLE_UPDATED_AT_SOURCES.has(updatedAtSource)) {
    return null;
  }

  const collectedAt = parseAuthorityTemporalDate(input.collectedAt);
  if (collectedAt && Math.abs(updatedAt.getTime() - collectedAt.getTime()) <= 1000) {
    return null;
  }

  const fetchedAt = parseAuthorityTemporalDate(input.fetchedAt);
  if (!fetchedAt) {
    return updatedAt;
  }

  const diff = Math.abs(updatedAt.getTime() - fetchedAt.getTime());
  if (diff <= FETCH_TIMESTAMP_UPDATED_AT_WINDOW_MS) {
    return null;
  }

  const sourceId = normalizeAuthoritySourceId(input);
  if (VOLATILE_UPDATED_AT_SOURCE_IDS.has(sourceId) && diff <= VOLATILE_SOURCE_FETCH_WINDOW_MS) {
    return null;
  }

  return updatedAt;
}

export function pickAuthorityUpdatedAt(
  candidates: Array<{ value?: string; source: AuthorityUpdatedAtSource }>,
): { updatedAt?: string; updatedAtSource?: AuthorityUpdatedAtSource } {
  const selected = candidates.find((candidate) => Boolean(candidate.value?.trim()));
  if (!selected) {
    return {};
  }

  return {
    updatedAt: selected.value,
    updatedAtSource: selected.source,
  };
}

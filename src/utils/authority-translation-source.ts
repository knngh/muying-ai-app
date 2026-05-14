import crypto from 'crypto';
import { normalizeWhitespace } from './article-translation';

export interface AuthorityTranslationSourceInput {
  question?: string;
  answer?: string;
  summary?: string;
  source_url?: string;
  url?: string;
  source?: string;
  source_org?: string;
  source_id?: string;
  original_id?: string;
  updated_at?: string;
  source_updated_at?: string;
  published_at?: string;
  created_at?: string;
}

export interface AuthorityTranslationCacheFreshnessInput {
  sourceUpdatedAt?: string;
  sourceFingerprint?: string;
}

export function resolveAuthorityTranslationSourceUpdatedAt(
  record: AuthorityTranslationSourceInput,
): string | undefined {
  return record.source_updated_at || record.published_at || record.updated_at || record.created_at;
}

function normalizeFingerprintPart(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return normalizeWhitespace(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFingerprintUrl(value: unknown): string {
  const raw = normalizeFingerprintPart(value);
  if (!raw) {
    return '';
  }

  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return raw;
  }
}

export function buildAuthorityTranslationSourceFingerprint(
  record: AuthorityTranslationSourceInput,
): string {
  const payload = [
    normalizeFingerprintUrl(record.source_url || record.url || record.original_id),
    normalizeFingerprintPart(record.source_id),
    normalizeFingerprintPart(record.source_org || record.source),
    normalizeFingerprintPart(record.question),
    normalizeFingerprintPart(record.summary),
    normalizeFingerprintPart(record.answer),
  ].join('\n---\n');

  return `sha256:${crypto.createHash('sha256').update(payload).digest('hex')}`;
}

export function isAuthorityTranslationCacheFresh(
  cached: AuthorityTranslationCacheFreshnessInput | null | undefined,
  current: AuthorityTranslationCacheFreshnessInput,
): boolean {
  if (!cached) {
    return false;
  }

  if (
    cached.sourceUpdatedAt
    && current.sourceUpdatedAt
    && cached.sourceUpdatedAt === current.sourceUpdatedAt
  ) {
    return true;
  }

  return Boolean(
    cached.sourceFingerprint
    && current.sourceFingerprint
    && cached.sourceFingerprint === current.sourceFingerprint,
  );
}

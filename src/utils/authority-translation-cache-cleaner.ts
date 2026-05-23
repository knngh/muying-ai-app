import {
  compactTranslationSummary,
  hasTranslationPromptLeak,
  isPlaceholderTranslationText,
  sanitizeTranslationText,
} from './article-translation';

export interface AuthorityTranslationCacheEntry {
  slug?: string;
  sourceUpdatedAt?: string;
  sourceFingerprint?: string;
  translatedTitle?: string;
  translatedSummary?: string;
  translatedContent?: string;
  translationNotice?: string;
  updatedAt?: string;
  model?: string;
  provider?: string;
  isSourceChinese?: boolean;
}

export interface CleanAuthorityTranslationCacheResult {
  total: number;
  kept: number;
  removed: number;
  removedEntries: Array<{ slug: string; reason: string }>;
  normalizedEntries: Array<{ slug: string; field: 'translatedSummary' }>;
  cleanedCache: Record<string, AuthorityTranslationCacheEntry>;
}

function detectBadTranslationReason(entry: AuthorityTranslationCacheEntry): string | null {
  const title = entry.translatedTitle || '';
  const summary = entry.translatedSummary || '';
  const content = entry.translatedContent || '';

  if ([title, summary, content].some((value) => value && hasTranslationPromptLeak(value))) {
    return 'prompt_leak';
  }

  if (!sanitizeTranslationText(content, 'content')) {
    return 'empty_or_invalid_content';
  }

  if ([title, summary, content].some((value) => value && isPlaceholderTranslationText(value))) {
    return 'placeholder_translation';
  }

  return null;
}

export function cleanAuthorityTranslationCache(
  cache: Record<string, AuthorityTranslationCacheEntry>,
): CleanAuthorityTranslationCacheResult {
  const cleanedCache: Record<string, AuthorityTranslationCacheEntry> = {};
  const removedEntries: Array<{ slug: string; reason: string }> = [];
  const normalizedEntries: Array<{ slug: string; field: 'translatedSummary' }> = [];

  for (const [slug, entry] of Object.entries(cache || {})) {
    const reason = detectBadTranslationReason(entry);
    if (reason) {
      removedEntries.push({ slug, reason });
      continue;
    }

    const compactedSummary = compactTranslationSummary(entry.translatedSummary || '', entry.translatedContent || '');
    const normalizedEntry = {
      ...entry,
      translatedSummary: compactedSummary || entry.translatedSummary,
    };

    if (normalizedEntry.translatedSummary !== entry.translatedSummary) {
      normalizedEntries.push({ slug, field: 'translatedSummary' });
    }

    cleanedCache[slug] = normalizedEntry;
  }

  return {
    total: Object.keys(cache || {}).length,
    kept: Object.keys(cleanedCache).length,
    removed: removedEntries.length,
    removedEntries,
    normalizedEntries,
    cleanedCache,
  };
}

export interface ArticleSourceUrlInput {
  source?: unknown;
  sourceUrl?: unknown;
  source_url?: unknown;
  url?: unknown;
  originalId?: unknown;
  original_id?: unknown;
  references?: unknown;
}

function normalizeHttpUrl(input: unknown): string {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) {
    return '';
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function getReferenceUrlCandidates(references: unknown): unknown[] {
  if (!Array.isArray(references)) {
    return [];
  }

  return references.flatMap((reference) => {
    if (!reference || typeof reference !== 'object') {
      return [];
    }

    const item = reference as {
      url?: unknown;
      sourceUrl?: unknown;
      source_url?: unknown;
      link?: unknown;
    };

    return [item.sourceUrl, item.source_url, item.url, item.link];
  });
}

export function resolveArticleSourceUrl(article: ArticleSourceUrlInput): string {
  const candidates = [
    article.sourceUrl,
    article.source_url,
    article.url,
    article.originalId,
    article.original_id,
    article.source,
    ...getReferenceUrlCandidates(article.references),
  ];

  for (const candidate of candidates) {
    const sourceUrl = normalizeHttpUrl(candidate);
    if (sourceUrl) {
      return sourceUrl;
    }
  }

  return '';
}

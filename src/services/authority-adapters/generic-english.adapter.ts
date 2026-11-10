import type { AuthoritySourceConfig } from '../../config/authority-sources';
import { pickAuthorityUpdatedAt } from '../../utils/authority-temporal';
import type { AuthorityRawDocument, NormalizedAuthorityDocument } from '../authority-sync.service';
import { extractHtmlContainers } from './html-content';
import {
  detectAudience,
  detectRiskLevelDefault,
  detectTopic,
  extractMetaContent,
  extractTitle,
  isMaternalInfantRelevant,
  shouldPublishDocument,
  stripHtml,
  type AuthorityDocumentAdapter,
} from './base.adapter';

const GENERIC_ENGLISH_SOURCE_IDS = new Set([
  'medlineplus',
  'nichd',
  'fda-women-health',
  'lactmed',
]);

function extractGenericEnglishContent(rawBody: string, sourceId: string): string {
  // A topic landing page's resource directory is discovery input, not guidance.
  const topic = sourceId === 'medlineplus'
    ? extractHtmlContainers(rawBody, [{ tag: 'div', id: /^topic-summary$/i }])[0] : undefined;
  const candidates = topic ? [topic] : extractHtmlContainers(rawBody, [
    { tag: 'article' },
    { tag: 'div', id: /^(?:maincontent|main-content|content|article|book_content)$/i },
    { tag: 'div', className: /(?:^|\s)(?:main-content|article-body|content-area|topic-content|book|chapter)(?:\s|$)/i },
    { tag: 'main' },
  ]);
  const content = (candidates[0] || rawBody)
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav\s*>/gi, '')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(?:p|li|h[1-6]|section|article|div)>/gi, '\n\n');
  // Strip markup per line so source paragraph and list boundaries survive.
  return content.split(/\n+/u).map(stripHtml).filter(Boolean).join('\n\n');
}

export const genericEnglishAdapter: AuthorityDocumentAdapter = {
  id: 'generic-english',
  supports(source: AuthoritySourceConfig): boolean {
    return source.parserId === 'generic-english' || GENERIC_ENGLISH_SOURCE_IDS.has(source.id);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const title = extractTitle(raw.rawBody);
    const description = extractMetaContent(raw.rawBody, 'description');
    const contentText = extractGenericEnglishContent(raw.rawBody, source.id);
    if (!contentText || contentText.length < 150) {
      return null;
    }

    const mergedText = `${title} ${description || ''} ${contentText}`;
    if (!isMaternalInfantRelevant(raw.url, title, mergedText)) {
      return null;
    }

    const temporal = pickAuthorityUpdatedAt([
      { value: extractMetaContent(raw.rawBody, 'article:modified_time'), source: 'article_modified_time' },
      { value: extractMetaContent(raw.rawBody, 'article:published_time'), source: 'article_published_time' },
      { value: extractMetaContent(raw.rawBody, 'date'), source: 'page_last_modified_meta' },
      { value: raw.lastModified, source: 'http_last_modified' },
    ]);

    const document: NormalizedAuthorityDocument = {
      sourceId: source.id,
      sourceOrg: source.org,
      sourceUrl: raw.url,
      sourceLanguage: source.language,
      sourceLocale: source.locale,
      title,
      updatedAt: temporal.updatedAt,
      audience: detectAudience({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      topic: detectTopic({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary: (description || contentText).slice(0, 300),
      contentText,
      metadataJson: {
        parserId: source.parserId,
        contentType: raw.contentType,
        fetchedAt: raw.fetchedAt,
        updatedAtSource: temporal.updatedAtSource,
      },
      publishStatus: 'draft',
    };

    document.publishStatus = shouldPublishDocument(document);
    return document;
  },
};

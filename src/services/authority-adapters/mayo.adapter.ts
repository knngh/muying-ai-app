import type { AuthoritySourceConfig } from '../../config/authority-sources';
import { pickAuthorityUpdatedAt } from '../../utils/authority-temporal';
import type { AuthorityRawDocument, NormalizedAuthorityDocument } from '../authority-sync.service';
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

function extractMayoContent(rawBody: string): string {
  const candidates = [
    rawBody.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)?.[1],
    rawBody.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)?.[1],
    rawBody.match(/<div[^>]+class=["'][^"']*(content|article-body|cmp-text|rich-text)[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[2],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const text = stripHtml(candidate);
    if (text.length >= 150) {
      return text;
    }
  }

  return stripHtml(rawBody);
}

function normalizeMayoTitle(title: string): string {
  return title
    .replace(/\s*[-|]\s*Mayo Clinic$/i, '')
    .trim();
}

export const mayoAdapter: AuthorityDocumentAdapter = {
  id: 'mayo',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.parserId === 'mayo'
      || /mayoclinic\.org/i.test(raw.url)
      || /Mayo Clinic/i.test(raw.rawBody);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const title = normalizeMayoTitle(extractTitle(raw.rawBody));
    const description = extractMetaContent(raw.rawBody, 'description');
    const contentText = extractMayoContent(raw.rawBody);
    if (!contentText || contentText.length < 150) {
      return null;
    }

    const mergedText = `${title} ${description || ''} ${contentText}`;
    if (!isMaternalInfantRelevant(raw.url, title, mergedText)) {
      return null;
    }
    const temporal = pickAuthorityUpdatedAt([
      { value: extractMetaContent(raw.rawBody, 'article:modified_time'), source: 'article_modified_time' },
      { value: extractMetaContent(raw.rawBody, 'dateModified'), source: 'schema_date_modified' },
      { value: extractMetaContent(raw.rawBody, 'last-modified'), source: 'page_last_modified_meta' },
      { value: raw.lastModified, source: 'http_last_modified' },
    ]);

    const document: NormalizedAuthorityDocument = {
      sourceId: source.id,
      sourceOrg: source.org,
      sourceUrl: raw.url,
      sourceLanguage: 'zh',
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
        parserId: 'mayo',
        sourceSite: 'mayoclinic',
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

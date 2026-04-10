import type { AuthoritySourceConfig } from '../../config/authority-sources';
import type { AuthorityRawDocument, NormalizedAuthorityDocument } from '../authority-sync.service';
import {
  detectAudience,
  detectRiskLevelDefault,
  detectTopic,
  shouldPublishDocument,
  stripHtml,
  type AuthorityDocumentAdapter,
} from './base.adapter';

function extractYoulaiGuideTitle(rawBody: string): string {
  const guideTitle = stripHtml(
    rawBody.match(/<h2[^>]+class=["'][^"']*h1-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1]
    || '有来医生孕期专题',
  );

  const week = rawBody.match(/怀孕第\s*<span[^>]+class=["'][^"']*select-curr-week[^"']*["'][^>]*>(\d+)<\/span>\s*周/i)?.[1]
    || rawBody.match(/怀孕第\s*(\d+)\s*周/i)?.[1];

  return week ? `${guideTitle}：怀孕第${week}周` : guideTitle;
}

function extractYoulaiGuideContent(rawBody: string): string {
  const contentStart = rawBody.match(/<div[^>]+id=["']yyContent["'][^>]*>/i);
  const contentEnd = rawBody.match(/<div[^>]+class=["'][^"']*nextArticle-wrap[^"']*["'][^>]*>/i);

  const startIndex = contentStart?.index;
  const endIndex = contentEnd?.index;
  const contentMarker = contentStart?.[0];
  const contentBlock = typeof startIndex === 'number'
    && typeof endIndex === 'number'
    && typeof contentMarker === 'string'
    && endIndex > startIndex
    ? rawBody.slice(startIndex + contentMarker.length, endIndex)
    : undefined;

  if (contentBlock) {
    const text = stripHtml(contentBlock);
    if (text.length >= 200) {
      return text;
    }
  }

  return stripHtml(rawBody);
}

export const youlaiAdapter: AuthorityDocumentAdapter = {
  id: 'youlai',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.parserId === 'youlai'
      || /m\.youlai\.cn\/special\/advisor\/[A-Za-z0-9]+\.html/i.test(raw.url);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const title = extractYoulaiGuideTitle(raw.rawBody);
    const contentText = extractYoulaiGuideContent(raw.rawBody);
    const summary = contentText.slice(0, 300);
    if (!contentText || contentText.length < 300) {
      return null;
    }

    const mergedText = `${title} ${contentText}`;
    const document: NormalizedAuthorityDocument = {
      sourceId: source.id,
      sourceOrg: source.org,
      sourceUrl: raw.url,
      title,
      updatedAt: undefined,
      audience: detectAudience({ sourceUrl: raw.url, title, summary, contentText }, source),
      topic: detectTopic({ sourceUrl: raw.url, title, summary, contentText }, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary,
      contentText,
      metadataJson: {
        parserId: 'youlai',
        contentType: raw.contentType,
        fetchedAt: raw.fetchedAt,
        sourceClass: 'medical_platform',
      },
      publishStatus: 'draft',
    };

    document.publishStatus = shouldPublishDocument(document);
    return document;
  },
};

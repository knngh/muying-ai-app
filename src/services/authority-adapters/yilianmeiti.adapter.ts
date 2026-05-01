import type { AuthoritySourceConfig } from '../../config/authority-sources';
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

function normalizeYilianmeitiTitle(title: string): string {
  return title
    .replace(/\s*[_-]\s*医联媒体.*$/u, '')
    .trim();
}

function extractYilianmeitiContent(rawBody: string): string {
  const candidates = [
    rawBody.match(/<div[^>]+class=["'][^"']*\bdetail\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?:<!--文章内容|<div[^>]+class=["'][^"']*customer)/i)?.[1],
    rawBody.match(/<div[^>]+class=["'][^"']*\bdetail\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
    rawBody.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)?.[1],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const text = stripHtml(candidate);
    if (text.length >= 150) {
      return text;
    }
  }

  return stripHtml(rawBody);
}

function extractYilianmeitiUpdatedAt(rawBody: string): string | undefined {
  return rawBody.match(/"pubDate"\s*:\s*"([^"]+)"/i)?.[1]
    || rawBody.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1]
    || extractMetaContent(rawBody, 'article:published_time')
    || extractMetaContent(rawBody, 'article:modified_time')
    || undefined;
}

export const yilianmeitiAdapter: AuthorityDocumentAdapter = {
  id: 'yilianmeiti',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.parserId === 'yilianmeiti'
      || /yilianmeiti\.com\/article\/\d+\.html/i.test(raw.url)
      || /医联媒体/u.test(raw.rawBody);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const title = normalizeYilianmeitiTitle(extractTitle(raw.rawBody));
    const description = extractMetaContent(raw.rawBody, 'description');
    const contentText = extractYilianmeitiContent(raw.rawBody);
    if (!contentText || contentText.length < 150) {
      return null;
    }

    const mergedText = `${title} ${description || ''} ${contentText}`;
    const topicText = `${description || ''} ${contentText}`;
    if (!isMaternalInfantRelevant(raw.url, title, mergedText)) {
      return null;
    }

    const document: NormalizedAuthorityDocument = {
      sourceId: source.id,
      sourceOrg: source.org,
      sourceUrl: raw.url,
      title,
      updatedAt: extractYilianmeitiUpdatedAt(raw.rawBody) || raw.lastModified,
      audience: detectAudience({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      topic: detectTopic({ sourceUrl: raw.url, title, summary: description, contentText: topicText }, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary: (description || contentText).slice(0, 300),
      contentText,
      metadataJson: {
        parserId: 'yilianmeiti',
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

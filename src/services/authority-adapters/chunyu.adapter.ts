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

function normalizeChunyuTitle(title: string): string {
  return title
    .replace(/\s*-\s*春雨医生$/u, '')
    .replace(/\s*春雨医生$/u, '')
    .trim();
}

function extractChunyuContent(rawBody: string): string {
  const candidates = [
    rawBody.match(/<div[^>]+class=["'][^"']*news-content[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[1],
    rawBody.match(/<section[^>]+class=["'][^"']*news-bd[^"']*["'][\s\S]*?>([\s\S]*?)<\/section>/i)?.[1],
    rawBody.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)?.[1],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const text = stripHtml(candidate);
    if (text.length >= 120) {
      return text;
    }
  }

  return stripHtml(rawBody);
}

function extractChunyuUpdatedAt(rawBody: string): string | undefined {
  return rawBody.match(/<div[^>]+class=["'][^"']*sub-title-wrapper[^"']*["'][\s\S]*?<span>([^<]+)<\/span>/i)?.[1]?.trim()
    || extractMetaContent(rawBody, 'article:published_time')
    || extractMetaContent(rawBody, 'article:modified_time')
    || undefined;
}

export const chunyuAdapter: AuthorityDocumentAdapter = {
  id: 'chunyu',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.parserId === 'chunyu'
      || /chunyuyisheng\.com\/m\/article\/\d+/i.test(raw.url)
      || /春雨医生/u.test(raw.rawBody);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const title = normalizeChunyuTitle(extractTitle(raw.rawBody));
    const description = extractMetaContent(raw.rawBody, 'description');
    const contentText = extractChunyuContent(raw.rawBody);
    if (!contentText || contentText.length < 150) {
      return null;
    }

    if (/【广告】|广告内容/u.test(contentText.slice(0, 240))) {
      return null;
    }

    const mergedText = `${title} ${description || ''} ${contentText}`;
    if (!isMaternalInfantRelevant(raw.url, title, mergedText)) {
      return null;
    }

    const document: NormalizedAuthorityDocument = {
      sourceId: source.id,
      sourceOrg: source.org,
      sourceUrl: raw.url,
      title,
      updatedAt: extractChunyuUpdatedAt(raw.rawBody) || raw.lastModified,
      audience: detectAudience({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      topic: detectTopic({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary: (description || contentText).slice(0, 300),
      contentText,
      metadataJson: {
        parserId: 'chunyu',
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

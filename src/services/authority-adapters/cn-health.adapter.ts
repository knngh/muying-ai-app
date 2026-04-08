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

function extractCnHealthContent(rawBody: string): string {
  const candidates = [
    rawBody.match(/<div[^>]+id=["']UCAP-CONTENT["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[1],
    rawBody.match(/<div[^>]+class=["'][^"']*(pages_content|TRS_Editor|trs_editor_view|article-content|wp_articlecontent)[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[2],
    rawBody.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)?.[1],
    rawBody.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)?.[1],
    rawBody.match(/<div[^>]+id=["'][^"']*(zoom|article|content)[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[2],
    rawBody.match(/<div[^>]+class=["'][^"']*(content|content-box|detail)[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[2],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const text = stripHtml(candidate);
    if (text.length >= 120) {
      return text;
    }
  }

  return stripHtml(rawBody);
}

function normalizeCnHealthTitle(title: string): string {
  return title
    .replace(/_[^_]+_中国政府网$/u, '')
    .replace(/_中国政府网$/u, '')
    .trim();
}

function normalizeCnHealthUpdatedAt(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}:\d{2}$/u.test(normalized)) {
    return normalized.replace(/^(\d{4}-\d{2}-\d{2})-(\d{2}:\d{2}:\d{2})$/u, '$1 $2');
  }

  return normalized;
}

export const cnHealthAdapter: AuthorityDocumentAdapter = {
  id: 'cn-health',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.parserId === 'cn-health'
      || /nhc\.gov\.cn|chinacdc\.cn|gov\.cn/i.test(raw.url);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const title = normalizeCnHealthTitle(extractTitle(raw.rawBody));
    const description = extractMetaContent(raw.rawBody, 'description');
    const contentText = extractCnHealthContent(raw.rawBody);
    if (!contentText || contentText.length < 120) {
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
      updatedAt: normalizeCnHealthUpdatedAt(
        extractMetaContent(raw.rawBody, 'article:published_time')
        || extractMetaContent(raw.rawBody, 'article:modified_time')
        || extractMetaContent(raw.rawBody, 'firstpublishedtime')
        || extractMetaContent(raw.rawBody, 'lastmodifiedtime')
        || extractMetaContent(raw.rawBody, 'publishdate')
        || raw.lastModified
      ),
      audience: detectAudience(mergedText, source),
      topic: detectTopic(mergedText, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary: (description || contentText).slice(0, 300),
      contentText,
      metadataJson: {
        parserId: 'cn-health',
        contentType: raw.contentType,
        fetchedAt: raw.fetchedAt,
      },
      publishStatus: 'draft',
    };

    document.publishStatus = shouldPublishDocument(document);
    return document;
  },
};

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

function extractAapContent(rawBody: string): string {
  const candidates = [
    rawBody.match(/<div[^>]+id=["']ctl00_cphPageContent_ctl00__ControlWrapper_RichHtmlField["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
    rawBody.match(/<div[^>]+id=["']ctl00_cphPageContent_PublishingPageContentField__ControlWrapper_RichHtmlField["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
    rawBody.match(/<div[^>]+class=["'][^"']*(article-body|hc-content|rich-text|field-body)[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[1],
    rawBody.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)?.[1],
    rawBody.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)?.[1],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const content = stripHtml(candidate);
    if (content.length >= 150) {
      return content;
    }
  }

  return stripHtml(rawBody);
}

export const aapAdapter: AuthorityDocumentAdapter = {
  id: 'aap',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.parserId === 'aap'
      || /healthychildren\.org/i.test(raw.url)
      || /healthychildren/i.test(raw.rawBody);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const title = extractTitle(raw.rawBody);
    const description = extractMetaContent(raw.rawBody, 'description');
    const contentText = extractAapContent(raw.rawBody);
    if (!contentText || contentText.length < 150) {
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
      updatedAt: extractMetaContent(raw.rawBody, 'article:modified_time')
        || extractMetaContent(raw.rawBody, 'last-modified')
        || raw.lastModified,
      audience: detectAudience({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      topic: detectTopic({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary: (description || contentText).slice(0, 300),
      contentText,
      metadataJson: {
        parserId: 'aap',
        sourceSite: 'healthychildren',
        contentType: raw.contentType,
        fetchedAt: raw.fetchedAt,
      },
      publishStatus: 'draft',
    };

    document.publishStatus = shouldPublishDocument(document);
    return document;
  },
};

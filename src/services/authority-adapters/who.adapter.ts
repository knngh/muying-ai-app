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

function extractWhoContent(rawBody: string): string {
  const candidates = [
    rawBody.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)?.[1],
    rawBody.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)?.[1],
    rawBody.match(/<div[^>]+class=["'][^"']*(sf_colsIn|content|article-body)[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[1],
  ].filter(Boolean) as string[];

  if (candidates.length > 0) {
    return stripHtml(candidates[0]);
  }

  return stripHtml(rawBody);
}

export const whoAdapter: AuthorityDocumentAdapter = {
  id: 'who',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.id === 'who' || /who\.int/i.test(raw.url);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const title = extractTitle(raw.rawBody);
    const description = extractMetaContent(raw.rawBody, 'description');
    const contentText = extractWhoContent(raw.rawBody);
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
      updatedAt: extractMetaContent(raw.rawBody, 'article:published_time') || raw.lastModified,
      audience: detectAudience(mergedText, source),
      topic: detectTopic(mergedText, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary: (description || contentText).slice(0, 300),
      contentText,
      metadataJson: {
        parserId: 'who',
        contentType: raw.contentType,
        fetchedAt: raw.fetchedAt,
      },
      publishStatus: 'draft',
    };

    document.publishStatus = shouldPublishDocument(document);
    return document;
  },
};

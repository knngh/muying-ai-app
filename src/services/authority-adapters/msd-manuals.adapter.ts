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

function extractMsdContent(rawBody: string): string {
  const candidates = [
    rawBody.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)?.[1],
    rawBody.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)?.[1],
    rawBody.match(/<div[^>]+class=["'][^"']*(topic__content|topic-content|article-content|content-body)[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>/i)?.[2],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const text = stripHtml(candidate);
    if (text.length >= 150) {
      return text;
    }
  }

  return stripHtml(rawBody);
}

function normalizeMsdTitle(title: string): string {
  return title
    .replace(/\s*[-|]\s*MSD Manuals?.*$/i, '')
    .replace(/\s*[-|]\s*《默沙东诊疗手册.*$/u, '')
    .trim();
}

export const msdManualsAdapter: AuthorityDocumentAdapter = {
  id: 'msd-manuals',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.parserId === 'msd-manuals'
      || /msdmanuals\.cn/i.test(raw.url)
      || /MSD Manuals|默沙东诊疗手册/u.test(raw.rawBody);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const title = normalizeMsdTitle(extractTitle(raw.rawBody));
    const description = extractMetaContent(raw.rawBody, 'description');
    const contentText = extractMsdContent(raw.rawBody);
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
      sourceLanguage: 'zh',
      sourceLocale: source.locale,
      title,
      updatedAt: extractMetaContent(raw.rawBody, 'article:modified_time')
        || extractMetaContent(raw.rawBody, 'last-modified')
        || extractMetaContent(raw.rawBody, 'dateModified')
        || raw.lastModified,
      audience: detectAudience({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      topic: detectTopic({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary: (description || contentText).slice(0, 300),
      contentText,
      metadataJson: {
        parserId: 'msd-manuals',
        sourceSite: 'msdmanuals',
        contentType: raw.contentType,
        fetchedAt: raw.fetchedAt,
      },
      publishStatus: 'draft',
    };

    document.publishStatus = shouldPublishDocument(document);
    return document;
  },
};

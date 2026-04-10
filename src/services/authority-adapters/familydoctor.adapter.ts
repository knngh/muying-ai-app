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

function normalizeFamilydoctorTitle(title: string): string {
  return title
    .replace(/\s*-\s*家庭医生在线家庭医生在线首页频道$/u, '')
    .replace(/\s*-\s*家庭医生在线.*$/u, '')
    .replace(/\s*家庭医生在线.*$/u, '')
    .trim();
}

function extractFamilydoctorContent(rawBody: string): string {
  const candidates = [
    rawBody.match(/<div[^>]+id=["']viewContent["'][^>]*>([\s\S]*?)<\/div>\s*<script/i)?.[1],
    rawBody.match(/<div[^>]+class=["'][^"']*viewContent[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<script/i)?.[1],
    rawBody.match(/<div[^>]+class=["'][^"']*js-detail[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<script/i)?.[1],
    rawBody.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)?.[1],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const text = stripHtml(candidate);
    if (text.length >= 150) {
      return text;
    }
  }

  return stripHtml(rawBody);
}

function extractFamilydoctorUpdatedAt(rawBody: string): string | undefined {
  return rawBody.match(/"upDate":"([^"]+)"/i)?.[1]
    || rawBody.match(/"pubDate":"([^"]+)"/i)?.[1]
    || rawBody.match(/<div[^>]+class=["'][^"']*info[^"']*["'][\s\S]*?<div[^>]+class=["']left["']>([^<&]+)(?:&nbsp;|<)/i)?.[1]?.trim()
    || extractMetaContent(rawBody, 'article:published_time')
    || extractMetaContent(rawBody, 'article:modified_time')
    || undefined;
}

export const familydoctorAdapter: AuthorityDocumentAdapter = {
  id: 'familydoctor',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.parserId === 'familydoctor'
      || /familydoctor\.com\.cn\/(?:baby\/)?a\/\d{6}\/\d+\.html/i.test(raw.url)
      || /家庭医生在线/u.test(raw.rawBody);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const title = normalizeFamilydoctorTitle(extractTitle(raw.rawBody));
    const description = extractMetaContent(raw.rawBody, 'description');
    const contentText = extractFamilydoctorContent(raw.rawBody);
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
      updatedAt: extractFamilydoctorUpdatedAt(raw.rawBody) || raw.lastModified,
      audience: detectAudience({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      topic: detectTopic({ sourceUrl: raw.url, title, summary: description, contentText: topicText }, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary: (description || contentText).slice(0, 300),
      contentText,
      metadataJson: {
        parserId: 'familydoctor',
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

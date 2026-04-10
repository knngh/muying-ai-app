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

interface DxyPayload {
  article?: {
    title?: string;
    publish_time?: string;
    content_brief?: string;
    content?: string;
  };
}

function normalizeDxyTitle(title: string): string {
  return title
    .replace(/\|?\s*丁香医生$/u, '')
    .trim();
}

function extractDxyPayload(rawBody: string): DxyPayload | null {
  const match = rawBody.match(/window\.\$\$data\s*=\s*(\{[\s\S]*?\})\s*<\/script>/i);
  if (!match?.[1]) {
    return null;
  }

  try {
    return JSON.parse(match[1]) as DxyPayload;
  } catch {
    return null;
  }
}

function extractDxyContent(rawBody: string, payload: DxyPayload | null): string {
  const payloadContent = payload?.article?.content;
  if (payloadContent) {
    const text = stripHtml(payloadContent);
    if (text.length >= 120) {
      return text;
    }
  }

  const candidates = [
    rawBody.match(/<div[^>]+class=["'][^"']*article-detail-content[^"']*["'][\s\S]*?>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1],
    rawBody.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)?.[1],
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

function extractDxyUpdatedAt(rawBody: string, payload: DxyPayload | null): string | undefined {
  return payload?.article?.publish_time
    || rawBody.match(/article-detail-publish["'][^>]*>([^<]+)</i)?.[1]?.trim()
    || extractMetaContent(rawBody, 'article:published_time')
    || extractMetaContent(rawBody, 'article:modified_time')
    || undefined;
}

export const dxyAdapter: AuthorityDocumentAdapter = {
  id: 'dxy',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.parserId === 'dxy'
      || /dxy\.com\/article\/\d+/i.test(raw.url)
      || /丁香医生/u.test(raw.rawBody);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const payload = extractDxyPayload(raw.rawBody);
    const title = normalizeDxyTitle(payload?.article?.title || extractTitle(raw.rawBody));
    const description = payload?.article?.content_brief || extractMetaContent(raw.rawBody, 'description');
    const contentText = extractDxyContent(raw.rawBody, payload);
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
      updatedAt: extractDxyUpdatedAt(raw.rawBody, payload) || raw.lastModified,
      audience: detectAudience({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      topic: detectTopic({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary: (description || contentText).slice(0, 300),
      contentText,
      metadataJson: {
        parserId: 'dxy',
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

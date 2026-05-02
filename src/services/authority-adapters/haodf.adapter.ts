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

function normalizeHaodfTitle(title: string): string {
  return title
    .replace(/\s*[_-]\s*好大夫在线.*$/u, '')
    .replace(/\s*-\s*好大夫在线$/u, '')
    .trim();
}

function extractHaodfContent(rawBody: string): string {
  const candidates = [
    rawBody.match(/<div[^>]+class=["'][^"']*article_detail[^"']*ql-editor[^"']*["'][^>]*>([\s\S]*?)<div[^>]+class=["']js-qn["']/i)?.[1],
    rawBody.match(/<div[^>]+class=["'][^"']*article_detail[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<p[^>]+class=["']dc-prompt/i)?.[1],
    rawBody.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1],
  ].filter(Boolean) as string[];

  const texts = candidates
    .map((candidate) => stripHtml(candidate)
      .replace(/\s*本文是.+?版权所有，未经授权请勿转载。?.*$/u, '')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean);

  for (const text of texts) {
    if (text.length >= 240) {
      return text;
    }
  }

  const bestShortText = texts.sort((left, right) => right.length - left.length)[0];
  if (bestShortText && bestShortText.length >= 100) {
    return bestShortText;
  }

  return stripHtml(rawBody);
}

function extractHaodfUpdatedAt(rawBody: string): string | undefined {
  return extractMetaContent(rawBody, 'og:release_date')
    || rawBody.match(/发表于[：:]\s*([\d-]{10})/u)?.[1]
    || rawBody.match(/release_date["']?\s*content=["']([^"']+)["']/i)?.[1]
    || extractMetaContent(rawBody, 'article:published_time')
    || extractMetaContent(rawBody, 'article:modified_time')
    || undefined;
}

function extractHaodfProfessionalSignal(rawBody: string): string | undefined {
  const identityText = stripHtml([
    rawBody.match(/本站已通过实名认证，所有内容由([\s\S]{2,80}?医生本人发表)/u)?.[0],
    rawBody.match(/<span[^>]+class=["']article_writer["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
    rawBody.match(/<a[^>]+class=["'][^"']*fdoc_info[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1],
  ].filter(Boolean).join(' '));

  const normalized = identityText.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 260) : undefined;
}

export const haodfAdapter: AuthorityDocumentAdapter = {
  id: 'haodf',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.parserId === 'haodf'
      || /haodf\.com\/neirong\/wenzhang\/\d+\.html/i.test(raw.url)
      || /好大夫在线/u.test(raw.rawBody);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const title = normalizeHaodfTitle(extractTitle(raw.rawBody));
    const description = extractMetaContent(raw.rawBody, 'description');
    const professionalSignal = extractHaodfProfessionalSignal(raw.rawBody);
    const articleContent = extractHaodfContent(raw.rawBody);
    const contentText = professionalSignal && !articleContent.includes(professionalSignal)
      ? `${professionalSignal} ${articleContent}`
      : articleContent;
    if (!contentText || contentText.length < 520) {
      return null;
    }

    const mergedText = `${title} ${description || ''} ${professionalSignal || ''} ${contentText}`;
    if (!/医学科普/u.test(raw.rawBody) || !/实名认证|医生本人发表/u.test(raw.rawBody)) {
      return null;
    }

    if (!isMaternalInfantRelevant(raw.url, title, mergedText)) {
      return null;
    }

    const document: NormalizedAuthorityDocument = {
      sourceId: source.id,
      sourceOrg: source.org,
      sourceUrl: raw.url,
      title,
      updatedAt: extractHaodfUpdatedAt(raw.rawBody) || raw.lastModified,
      audience: detectAudience({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      topic: detectTopic({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary: (description || contentText).slice(0, 300),
      contentText,
      metadataJson: {
        parserId: 'haodf',
        contentType: raw.contentType,
        fetchedAt: raw.fetchedAt,
        sourceClass: 'medical_platform',
        professionalSignal,
      },
      publishStatus: 'draft',
    };

    document.publishStatus = shouldPublishDocument(document);
    return document;
  },
};

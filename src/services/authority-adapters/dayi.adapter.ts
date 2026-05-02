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

function normalizeDayiTitle(title: string): string {
  return title
    .replace(/\s*[|｜]\s*中国医药信息查询平台.*$/u, '')
    .replace(/\s*_\s*[^_]+_[^_]+$/u, '')
    .trim();
}

function extractDayiArticleContent(rawBody: string): string {
  const candidates = [
    rawBody.match(/<div[^>]+class=["'][^"']*article-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1],
    rawBody.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1],
    rawBody.match(/<div[^>]+class=["'][^"']*long-container[^"']*["'][^>]*>([\s\S]*?)<\/article>/i)?.[1],
    rawBody.match(/<div[^>]+class=["'][^"']*main-body[^"']*["'][^>]*>([\s\S]*?)<div[^>]+class=["'][^"']*end[^"']*["']/i)?.[1],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const text = stripHtml(candidate);
    if (text.length >= 160) {
      return text;
    }
  }

  return stripHtml(rawBody);
}

function extractDayiReviewText(rawBody: string): string | undefined {
  const candidates = [
    rawBody.match(/<div[^>]+class=["'][^"']*doctor-container[^"']*["'][^>]*>([\s\S]*?)(?:<div[^>]+class=["'][^"']*article-content|<\/article>)/i)?.[1],
    rawBody.match(/<div[^>]+class=["'][^"']*doctor-container[^"']*["'][\s\S]*?<\/div>\s*<\/a>\s*<\/div>/i)?.[0],
    rawBody.match(/<div[^>]+class=["'][^"']*audit-doctor-container[^"']*["'][\s\S]*?<\/aside>/i)?.[0],
    rawBody.match(/<div[^>]+class=["'][^"']*renzheng[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const text = stripHtml(candidate)
      .replace(/\s+/g, ' ')
      .trim();
    if (/(审核|认证|主任医师|副主任医师|主治医师|三甲|国家重点专科)/u.test(text)) {
      return text.slice(0, 220);
    }
  }

  const auditDoctorMatch = rawBody.match(/auditDoctor:\{[\s\S]{0,900}?name:"([^"]+)"[\s\S]{0,400}?clinicProfessional:"([^"]+)"[\s\S]{0,500}?institutionName:"([^"]+)"/i);
  if (auditDoctorMatch?.[1]) {
    return `审核医生：${auditDoctorMatch[1]} ${auditDoctorMatch[2] || ''} ${auditDoctorMatch[3] || ''}`.trim();
  }

  return undefined;
}

function extractDayiUpdatedAt(rawBody: string): string | undefined {
  return rawBody.match(/发布时间：\s*([\d-]{10}\s+\d{2}:\d{2})/u)?.[1]
    || rawBody.match(/createTime:"([^"]+)"/i)?.[1]
    || rawBody.match(/"createTime"\s*:\s*"([^"]+)"/i)?.[1]
    || rawBody.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1]
    || extractMetaContent(rawBody, 'article:published_time')
    || extractMetaContent(rawBody, 'article:modified_time')
    || undefined;
}

export const dayiAdapter: AuthorityDocumentAdapter = {
  id: 'dayi',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.parserId === 'dayi'
      || /dayi\.org\.cn\/(?:disease|symptom|qa)\/\d+(?:\.html)?/i.test(raw.url)
      || /中国医药信息查询平台/u.test(raw.rawBody);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const title = normalizeDayiTitle(extractTitle(raw.rawBody));
    const description = extractMetaContent(raw.rawBody, 'description');
    const reviewText = extractDayiReviewText(raw.rawBody);
    const articleContent = extractDayiArticleContent(raw.rawBody);
    const contentText = reviewText && !articleContent.includes(reviewText)
      ? `${reviewText} ${articleContent}`
      : articleContent;

    if (!contentText || contentText.length < 220) {
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
      updatedAt: extractDayiUpdatedAt(raw.rawBody) || raw.lastModified,
      audience: detectAudience({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      topic: detectTopic({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary: (description || contentText).slice(0, 300),
      contentText,
      metadataJson: {
        parserId: 'dayi',
        contentType: raw.contentType,
        fetchedAt: raw.fetchedAt,
        sourceClass: 'medical_platform',
        professionalSignal: reviewText || undefined,
      },
      publishStatus: 'draft',
    };

    document.publishStatus = shouldPublishDocument(document);
    if (document.publishStatus === 'published' && contentText.length < 600) {
      document.publishStatus = 'review';
    }
    return document;
  },
};

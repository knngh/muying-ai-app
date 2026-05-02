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

interface KepuchinaStructuredArticle {
  headline?: string;
  name?: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  author?: {
    name?: string;
    description?: string;
  };
  publisher?: {
    name?: string;
  };
  keywords?: string;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/giu, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/gu, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeKepuchinaText(input: string): string {
  return decodeHtmlEntities(stripHtml(input))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKepuchinaTitle(title: string): string {
  return normalizeKepuchinaText(title)
    .replace(/\s*-\s*·\s*科普中国网$/u, '')
    .replace(/\s*·\s*科普中国网$/u, '')
    .replace(/^\[科普中国\][-－]\s*/u, '')
    .trim();
}

function normalizeKepuchinaDescription(description: string): string {
  const normalized = normalizeKepuchinaText(description);
  return /科普中国网是中国科协主办的权威科普平台/u.test(normalized) ? '' : normalized;
}

function parseKepuchinaStructuredArticle(rawBody: string): KepuchinaStructuredArticle | undefined {
  for (const match of rawBody.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const jsonText = decodeHtmlEntities(match[1] || '').trim();
    if (!jsonText) {
      continue;
    }

    try {
      const parsed = JSON.parse(jsonText) as KepuchinaStructuredArticle | KepuchinaStructuredArticle[];
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      const article = candidates.find((item) => item && (item.headline || item.name));
      if (article) {
        return article;
      }
    } catch {
      // Ignore malformed JSON-LD and fall back to DOM extraction.
    }
  }

  return undefined;
}

function trimKepuchinaArticleBoilerplate(text: string): string {
  const markers = [
    /(?:^|\s)作者\s*[|｜:：]/u,
    /(?:^|\s)专家\s*[|｜:：]/u,
    /(?:^|\s)\|\s*科室介绍/u,
    /(?:^|\s)内容来自\s*[：:]/u,
    /(?:^|\s)内容资源由项目单位提供/u,
  ];
  const markerIndexes = markers
    .map((pattern) => text.search(pattern))
    .filter((index) => index >= 0);
  const firstMarker = markerIndexes.length > 0 ? Math.min(...markerIndexes) : -1;
  return (firstMarker >= 0 ? text.slice(0, firstMarker) : text).trim();
}

function extractKepuchinaArticleHtml(rawBody: string): string | undefined {
  return rawBody.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || rawBody.match(/<div[^>]+class=["'][^"']*article-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1]
    || rawBody.match(/<div[^>]+class=["'][^"']*content-detail[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div[^>]+class=["'][^"']*share/i)?.[1]
    || undefined;
}

function extractKepuchinaContent(rawBody: string): string {
  const articleHtml = extractKepuchinaArticleHtml(rawBody);
  if (articleHtml) {
    const text = trimKepuchinaArticleBoilerplate(normalizeKepuchinaText(articleHtml));
    if (text.length >= 150) {
      return text;
    }
  }

  return trimKepuchinaArticleBoilerplate(normalizeKepuchinaText(rawBody));
}

function extractKepuchinaProfessionalSignal(rawBody: string, structured?: KepuchinaStructuredArticle): string | undefined {
  const articleText = normalizeKepuchinaText(extractKepuchinaArticleHtml(rawBody) || rawBody);
  const matches = [
    articleText.match(/作者\s*[|｜:：]\s*(.{2,220}?)(?=\s*(?:\|\s*科室介绍|内容来自|内容资源由|$))/u)?.[1],
    articleText.match(/专家\s*[|｜:：]\s*(.{2,180}?)(?=\s*(?:内容来自|内容资源由|$))/u)?.[1],
    rawBody.match(/内容来自\s*[：:]\s*([^<]{2,80})/u)?.[1],
    structured?.author?.name,
    structured?.author?.description,
  ].map((item) => (item || '').trim()).filter(Boolean);

  const signal = Array.from(new Set(matches)).join(' ');
  return signal ? signal.slice(0, 260) : undefined;
}

function hasKepuchinaProfessionalSignal(text: string): boolean {
  return /(中华医学会|中国医师协会|中国营养学会|中国疾病预防控制中心|中国健康教育中心|人民网科普|达医晓护|福棠儿童用药咨询中心|母婴健康|医学专家|专家|主任医师|副主任医师|主治医师|医师|医生|主任护师|护师|护士长|医院|妇产科|产科|儿科|新生儿科|营养科)/u.test(text);
}

function isFocusedKepuchinaMaternalInfantText(text: string): boolean {
  return /(3岁以下|三岁以下|0[~～-]3岁|0到3岁|备孕|孕产|孕妇|孕期|孕早期|孕中期|孕晚期|妊娠|产检|产后|产妇|分娩|乳母|母乳|哺乳|喂养|辅食|配方奶|新生儿|婴儿|婴幼儿|宝宝|胎便|脐部|脐带|黄疸|婴幼儿护理|新生儿护理)/u.test(text);
}

function extractKepuchinaUpdatedAt(rawBody: string, structured?: KepuchinaStructuredArticle): string | undefined {
  return structured?.dateModified
    || structured?.datePublished
    || rawBody.match(/datePublished["']?\s*:\s*["']([^"']+)["']/i)?.[1]
    || rawBody.match(/dateModified["']?\s*:\s*["']([^"']+)["']/i)?.[1]
    || extractMetaContent(rawBody, 'article:published_time')
    || extractMetaContent(rawBody, 'article:modified_time')
    || undefined;
}

export const kepuchinaAdapter: AuthorityDocumentAdapter = {
  id: 'kepuchina',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.parserId === 'kepuchina'
      || /kepuchina\.cn\/article\/articleinfo\?/i.test(raw.url)
      || /科普中国网/u.test(raw.rawBody);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const structured = parseKepuchinaStructuredArticle(raw.rawBody);
    const title = normalizeKepuchinaTitle(structured?.headline || structured?.name || extractTitle(raw.rawBody));
    const description = normalizeKepuchinaDescription(
      structured?.description || extractMetaContent(raw.rawBody, 'description') || '',
    );
    const contentText = extractKepuchinaContent(raw.rawBody);
    const professionalSignal = extractKepuchinaProfessionalSignal(raw.rawBody, structured);
    const signalText = `${structured?.author?.name || ''} ${structured?.author?.description || ''} ${professionalSignal || ''} ${contentText}`;

    if (!contentText || contentText.length < 800) {
      return null;
    }

    if (!hasKepuchinaProfessionalSignal(signalText)) {
      return null;
    }

    const mergedText = `${title} ${description} ${contentText}`;
    if (!isFocusedKepuchinaMaternalInfantText(mergedText.slice(0, 1800))) {
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
      updatedAt: extractKepuchinaUpdatedAt(raw.rawBody, structured) || raw.lastModified,
      audience: detectAudience({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      topic: detectTopic({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary: (description || contentText).slice(0, 300),
      contentText,
      metadataJson: {
        parserId: 'kepuchina',
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

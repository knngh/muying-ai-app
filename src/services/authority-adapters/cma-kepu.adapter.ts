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

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/giu, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/gu, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeCmaText(input: string): string {
  return decodeHtmlEntities(stripHtml(input))
    .replace(/([年月日])\s*(\d)\s+(\d)(?=\s*[年月日号])/gu, '$1$2$3')
    .replace(/(\d)\s+(\d)(?=\s*年)/gu, '$1$2')
    .replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/gu, '$1$2')
    .replace(/(\d)\s+([年月日])/gu, '$1$2')
    .replace(/([\u4e00-\u9fff\d])\s+([，。！？、；：])/gu, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCmaTitle(title: string): string {
  return normalizeCmaText(title)
    .replace(/^中华医学会\s*科普图文\s*/u, '')
    .replace(/\s*[-_]\s*中华医学会.*$/u, '')
    .trim();
}

function extractCmaArticleHtml(rawBody: string): string | undefined {
  return rawBody.match(/<!--ZJEG_RSS\.content\.begin-->([\s\S]*?)<!--ZJEG_RSS\.content\.end-->/i)?.[1]
    || rawBody.match(/<!--<\$?\[信息内容\]>begin-->([\s\S]*?)<!--<\$?\[信息内容\]>end-->/i)?.[1]
    || rawBody.match(/<div[^>]+id=["']zoom["'][^>]*>([\s\S]*?)<\/div>\s*<\/td>\s*<\/tr>/i)?.[1]
    || rawBody.match(/<div[^>]+id=["']zoom["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
    || undefined;
}

function extractCmaContent(rawBody: string): string {
  const articleHtml = extractCmaArticleHtml(rawBody);
  if (articleHtml) {
    const text = normalizeCmaText(articleHtml);
    if (text.length >= 160) {
      return text;
    }
  }

  return normalizeCmaText(rawBody);
}

function extractCmaUpdatedAt(rawBody: string): string | undefined {
  return extractMetaContent(rawBody, 'pubdate')
    || extractMetaContent(rawBody, 'PubDate')
    || extractMetaContent(rawBody, 'publishdate')
    || extractMetaContent(rawBody, 'ArticlePubDate')
    || rawBody.match(/发布日期[：:]\s*([0-9]{4}-[0-9]{2}-[0-9]{2}(?:\s+[0-9]{2}:[0-9]{2}(?::[0-9]{2})?)?)/u)?.[1]
    || undefined;
}

function extractCmaProfessionalSignal(rawBody: string): string | undefined {
  const articleText = normalizeCmaText(extractCmaArticleHtml(rawBody) || rawBody);
  const contentSource = extractMetaContent(rawBody, 'contentSource');
  const author = extractMetaContent(rawBody, 'author');
  const matches = [
    contentSource,
    author,
    articleText.match(/作者[：:]\s*.{2,180}?(?=\s+审核[：:]|$)/u)?.[0],
    articleText.match(/审核[：:]\s*.{2,180}$/u)?.[0],
  ]
    .map((item) => (item || '').trim())
    .filter(Boolean);
  const signal = Array.from(new Set(matches)).join(' ');
  return signal ? signal.slice(0, 360) : undefined;
}

function hasCmaProfessionalSignal(text: string): boolean {
  return /(中华医学会|科学普及部|科普中国|审核|作者|主任医师|副主任医师|主治医师|医师|医生|教授|研究员|儿童医院|妇产医院|妇幼保健院|儿科|新生儿科|妇产科|产科)/u.test(text);
}

function isFocusedCmaMaternalInfantText(text: string): boolean {
  return /(3岁以下|三岁以下|0[~～-]3岁|0到3岁|备孕|孕产|孕妇|孕期|孕早期|孕中期|孕晚期|妊娠|产检|产后|产妇|分娩|乳母|母乳|哺乳|喂养|辅食|配方奶|新生儿|早产儿|婴儿|婴幼儿|宝宝|胎儿|胎动|叶酸|黄疸|婴幼儿护理|新生儿护理|儿童.{0,8}(?:发热|腹泻|咳嗽|过敏|鼻炎|身高|发育|疫苗|接种)|孩子.{0,8}(?:发热|腹泻|咳嗽|过敏|鼻炎|身高|发育|疫苗|接种))/u.test(text);
}

export const cmaKepuAdapter: AuthorityDocumentAdapter = {
  id: 'cma-kepu',
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean {
    return source.parserId === 'cma-kepu'
      || /cma\.org\.cn\/art\/\d{4}\/\d{1,2}\/\d{1,2}\/art_4584_\d+\.html/i.test(raw.url);
  },
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null {
    const title = normalizeCmaTitle(extractMetaContent(raw.rawBody, 'ArticleTitle') || extractTitle(raw.rawBody));
    const description = normalizeCmaText(extractMetaContent(raw.rawBody, 'description') || '');
    const contentText = extractCmaContent(raw.rawBody);
    const professionalSignal = extractCmaProfessionalSignal(raw.rawBody);

    if (!contentText || contentText.length < 300) {
      return null;
    }

    const mergedText = `${title} ${description} ${professionalSignal || ''} ${contentText}`;
    if (!isFocusedCmaMaternalInfantText(mergedText.slice(0, 2200))) {
      return null;
    }

    if (!hasCmaProfessionalSignal(`${professionalSignal || ''} ${contentText.slice(-500)}`)) {
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
      updatedAt: extractCmaUpdatedAt(raw.rawBody) || raw.lastModified,
      audience: detectAudience({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      topic: detectTopic({ sourceUrl: raw.url, title, summary: description, contentText }, source),
      region: source.region,
      riskLevelDefault: detectRiskLevelDefault(mergedText),
      summary: (description || contentText).slice(0, 300),
      contentText,
      metadataJson: {
        parserId: 'cma-kepu',
        contentType: raw.contentType,
        fetchedAt: raw.fetchedAt,
        sourceClass: 'official',
        professionalSignal,
      },
      publishStatus: 'draft',
    };

    document.publishStatus = shouldPublishDocument(document);
    return document;
  },
};

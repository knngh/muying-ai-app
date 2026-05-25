import {
  formatKnowledgeStageLabel,
  formatSourceLabel,
  getLocalizedFallbackTitle,
  isGenericForeignTitle,
  isMostlyChineseText,
  normalizePlainText,
  stripHtmlTags,
} from './knowledge-text';
import { compactTranslationSummary, sanitizeTranslationText } from './article-translation';
import type { KnowledgeVariantSortMode } from './knowledge-dedupe';
import { isChineseKnowledgeSource } from './knowledge-source';

export type KnowledgeTranslationLike = {
  translatedTitle?: string;
  translatedSummary?: string;
  translatedContent?: string;
  isSourceChinese?: boolean;
};

export type KnowledgeTagLike = {
  id?: number | string;
  name: string;
};

export type KnowledgeCategoryLike = {
  name: string;
  slug?: string;
};

export type KnowledgeArticleLike = {
  title?: string;
  summary?: string;
  content?: string;
  displayTitle?: string;
  displaySummary?: string;
  displayContent?: string;
  translation?: KnowledgeTranslationLike | null;
  hasChineseTranslation?: boolean;
  readingTime?: number;
  readTime?: number;
  read_time?: number;
  readableTextLength?: number;
  readableTextUnit?: '字' | '词';
  wordCount?: number;
  characterCount?: number;
  sourceOrg?: string;
  source?: string;
  region?: string;
  sourceUrl?: string;
  source_url?: string;
  url?: string;
  sourceUpdatedAt?: string;
  publishedAt?: string;
  createdAt?: string;
  sourceLanguage?: 'zh' | 'en';
  sourceLocale?: string;
  audience?: string;
  topic?: string;
  stage?: string;
  category?: KnowledgeCategoryLike;
  tags?: KnowledgeTagLike[];
  originalId?: string;
  original_id?: string;
  references?: KnowledgeSourceReferenceLike[];
};

export type KnowledgeSourceReferenceLike = {
  sourceUrl?: unknown;
  source_url?: unknown;
  url?: unknown;
  link?: unknown;
};

type ParsedSourceUrl = {
  normalizedUrl: string;
  hostname: string;
  pathname: string;
  readablePath: string;
};

export type KnowledgeReadingPathItem = {
  title: string;
  description: string;
};

export type KnowledgeReadingPath = {
  kicker: string;
  title: string;
  description: string;
  items: KnowledgeReadingPathItem[];
};

export type KnowledgeReadingMeta = {
  estimatedMinutes: number;
  estimatedMinutesLabel: string;
  textLength: number;
  textLengthLabel: string;
  sectionCount: number;
  sectionLabel: string;
  contentMode: 'body' | 'summary';
  contentModeLabel: string;
};

export type KnowledgeVariantPreview = {
  sourceLabel: string;
  chips: string[];
};

export type KnowledgeSourceDigest = {
  sourceLabels: string[];
  sourceCount: number;
  chineseCount: number;
  totalCount: number;
  summaryLabel: string;
  description: string;
};

export type KnowledgeDisplayContent = {
  title: string;
  summary: string;
  content: string;
  translation: KnowledgeTranslationLike | null;
  hasChineseTranslation: boolean;
  isTranslated: boolean;
};

export type KnowledgeOriginalContent = {
  title: string;
  summary: string;
  content: string;
};

export type KnowledgeVariantReadingSuggestion = {
  label: string;
  description: string;
};

export type KnowledgeVariantSortFeedback = {
  label: string;
  description: string;
};

export function normalizeKnowledgeLabel(label?: string): string {
  const value = (label || '').trim();
  if (!value) return '';

  const lower = value.toLowerCase();
  const sourceLabel = formatSourceLabel(value);
  if (sourceLabel !== value) {
    return sourceLabel;
  }

  const mapped = {
    pregnancy: '孕期',
    postpartum: '产后恢复',
    newborn: '新生儿',
    policy: '指南/政策',
    parenting: '养育',
    nutrition: '营养',
    vaccine: '疫苗',
    vaccination: '疫苗',
    child: '儿童',
    toddler: '幼儿',
    infant: '婴儿',
    breastfeeding: '喂养',
    feeding: '喂养',
    development: '发育',
    'common-symptoms': '常见症状',
  }[lower];

  return mapped || value;
}

export function getKnowledgeSourceLabel(article: KnowledgeArticleLike): string {
  return formatSourceLabel(article.sourceOrg || article.source || article.region || '权威内容');
}

export function getKnowledgeStageLabel(stage?: string, emptyLabel = '全阶段'): string {
  if (!stage) {
    return emptyLabel;
  }

  return formatKnowledgeStageLabel(stage) || emptyLabel;
}

export function formatKnowledgeDisplayDate(article: KnowledgeArticleLike, locale = 'zh-CN'): string {
  const value = article.sourceUpdatedAt || article.publishedAt || article.createdAt;
  if (!value) return '最近同步';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '最近同步';

  return locale === 'iso'
    ? date.toISOString().slice(0, 10)
    : date.toLocaleDateString(locale);
}

export function isChineseKnowledgeArticle(article: KnowledgeArticleLike): boolean {
  return isChineseKnowledgeSource(article);
}

export function getKnowledgeSourceSignal(article: KnowledgeArticleLike): string {
  return isChineseKnowledgeArticle(article) ? '中文源' : '国际源';
}

export function normalizeKnowledgeArticleTranslation(
  translation?: KnowledgeTranslationLike | null,
): KnowledgeTranslationLike | null {
  if (!translation) {
    return null;
  }

  const normalized = {
    ...translation,
    translatedTitle: sanitizeTranslationText(translation.translatedTitle, 'title'),
    translatedSummary: sanitizeTranslationText(translation.translatedSummary, 'summary'),
    translatedContent: sanitizeTranslationText(translation.translatedContent, 'content'),
  };

  if (!normalized.translatedContent) {
    return null;
  }

  return normalized;
}

function hasChineseText(input?: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff]/u.test(input || '');
}

function isLikelyForeignDisplayText(input?: string): boolean {
  const text = normalizePlainText(input);
  if (!text || hasChineseText(text)) {
    return false;
  }

  return (text.match(/[A-Za-z]/g) || []).length >= 4;
}

function cleanTranslatedContentText(input?: string): string {
  return stripHtmlTags(input || '')
    .replace(/(?:译后|翻译后)?(?:的)?(?:标题|摘要|正文)[:：]/gu, '\n')
    .replace(/<\/?(?:title|summary|content)>/giu, '\n')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function getChineseTranslatedContent(article?: KnowledgeArticleLike | null): string {
  const displayContent = sanitizeTranslationText(article?.displayContent, 'content');
  if (displayContent && isMostlyChineseText(displayContent)) {
    return displayContent;
  }

  const translation = normalizeKnowledgeArticleTranslation(article?.translation);
  const translatedContent = translation?.translatedContent || '';
  if (translatedContent && isMostlyChineseText(translatedContent)) {
    return translatedContent;
  }

  const articleContent = sanitizeTranslationText(article?.content, 'content');
  if (
    articleContent
    && isMostlyChineseText(articleContent)
    && (
      article?.hasChineseTranslation
      || isLikelyForeignDisplayText(article?.title)
      || isLikelyForeignDisplayText(article?.summary)
    )
  ) {
    return articleContent;
  }

  return '';
}

function normalizeChineseTitleCandidate(input?: string): string {
  const text = normalizePlainText(input)
    .replace(/^(?:译后|翻译后)?(?:的)?(?:标题|摘要|正文)[:：]\s*/u, '')
    .replace(/^[-*•·]\s*/u, '')
    .trim();

  if (!hasChineseText(text)) {
    return '';
  }

  const sentence = text.match(/[^。！？!?；;\n]+[。！？!?；;]?/u)?.[0]?.trim() || text;
  return sentence.length > 34 ? `${sentence.slice(0, 34).trim()}...` : sentence;
}

function isMetadataOrBylineLine(input: string): boolean {
  const line = normalizePlainText(input);
  if (!line) {
    return true;
  }

  return /^(?:作者|关于作者|来源|参考来源|更多信息|更新日期|最后更新|责任编辑|Article Body|Last Updated|More Information|About the authors?|By\s*[:：])/iu.test(line)
    || (/(?:医学博士|博士|作者|FAAP|MD|M\.D\.|PhD|OTR|CEIM|IBCLC)/iu.test(line) && /^.{0,8}(?:作者|By|关于)/iu.test(line));
}

function getTranslatedContentLines(content?: string): string[] {
  return cleanTranslatedContentText(content)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function deriveChineseTitleFromTranslatedContent(content?: string): string {
  const lines = getTranslatedContentLines(content);
  if (lines.length === 0) {
    return '';
  }

  const titleLine = lines.find((line) => {
    const normalized = normalizePlainText(line);
    return hasChineseText(normalized)
      && normalized.length >= 4
      && normalized.length <= 48
      && !/[。！？!?；;]$/u.test(normalized)
      && !isMetadataOrBylineLine(normalized);
  });

  return normalizeChineseTitleCandidate(titleLine || lines.find((line) => hasChineseText(line) && !isMetadataOrBylineLine(line)) || '');
}

function deriveChineseSummaryFromTranslatedContent(content?: string, title?: string): string {
  const lines = getTranslatedContentLines(content);
  if (lines.length === 0) {
    return '';
  }

  const titleText = normalizePlainText(title);
  const candidates = lines
    .map((line) => normalizePlainText(line))
    .filter((line) => line && hasChineseText(line))
    .filter((line) => !isMetadataOrBylineLine(line))
    .filter((line) => !titleText || line !== titleText);
  const source = candidates.find((line) => /[。！？!?；;]/u.test(line) || line.length >= 24)
    || candidates[0]
    || '';

  return compactTranslationSummary(source, '', 96);
}

function shouldUseChineseContentFallback(candidate: string, translatedContent: string): boolean {
  return Boolean(translatedContent && isLikelyForeignDisplayText(candidate));
}

export function resolveKnowledgeDisplayContent(article: KnowledgeArticleLike | null | undefined): KnowledgeDisplayContent {
  const translation = normalizeKnowledgeArticleTranslation(article?.translation);
  const displayContent = sanitizeTranslationText(article?.displayContent, 'content');
  const translatedContent = translation?.translatedContent || '';
  const chineseTranslatedContent = getChineseTranslatedContent(article);
  const derivedChineseTitle = deriveChineseTitleFromTranslatedContent(chineseTranslatedContent);
  const displayTitle = sanitizeTranslationText(article?.displayTitle, 'title');
  const displaySummary = sanitizeTranslationText(article?.displaySummary, 'summary');
  const translatedTitle = translation?.translatedTitle || '';
  const translatedSummary = translation?.translatedSummary || '';
  const safeDisplayTitle = shouldUseChineseContentFallback(displayTitle, chineseTranslatedContent) ? '' : displayTitle;
  const safeTranslatedTitle = shouldUseChineseContentFallback(translatedTitle, chineseTranslatedContent) ? '' : translatedTitle;
  const safeDisplaySummary = shouldUseChineseContentFallback(displaySummary, chineseTranslatedContent) ? '' : displaySummary;
  const safeTranslatedSummary = shouldUseChineseContentFallback(translatedSummary, chineseTranslatedContent) ? '' : translatedSummary;
  const derivedChineseSummary = deriveChineseSummaryFromTranslatedContent(chineseTranslatedContent, derivedChineseTitle);
  const hasChineseTranslation = Boolean(
    article?.hasChineseTranslation
      || displayTitle
      || displaySummary
      || displayContent
      || translatedTitle
      || translatedSummary
      || translatedContent,
  );

  const title = safeDisplayTitle
    || safeTranslatedTitle
    || derivedChineseTitle
    || getKnowledgeDisplayTitle(article || {});
  const summary = safeDisplaySummary
    || safeTranslatedSummary
    || derivedChineseSummary
    || getKnowledgeDisplaySummary(article || {}, '');
  const content = displayContent
    || translatedContent
    || article?.content
    || '';

  return {
    title,
    summary,
    content,
    translation,
    hasChineseTranslation,
    isTranslated: Boolean(displayTitle || displaySummary || displayContent || translatedTitle || translatedSummary || translatedContent),
  };
}

export function resolveKnowledgeOriginalContent(article: KnowledgeArticleLike | null | undefined): KnowledgeOriginalContent {
  const title = (article?.title || '').trim()
    || getLocalizedFallbackTitle({
      topic: article?.topic,
      stage: article?.stage,
      categoryName: article?.category?.name,
    });

  return {
    title,
    summary: article?.summary || '',
    content: article?.content || '',
  };
}

export function getKnowledgeDisplayTitle(article: KnowledgeArticleLike): string {
  const chineseTranslatedContent = getChineseTranslatedContent(article);
  const derivedChineseTitle = deriveChineseTitleFromTranslatedContent(chineseTranslatedContent);
  const displayTitle = sanitizeTranslationText(article.displayTitle, 'title');
  if (displayTitle) {
    if (shouldUseChineseContentFallback(displayTitle, chineseTranslatedContent)) {
      return derivedChineseTitle || getLocalizedFallbackTitle({
        topic: article.topic,
        stage: article.stage,
        categoryName: article.category?.name,
      });
    }
    return displayTitle;
  }

  const translation = normalizeKnowledgeArticleTranslation(article.translation);
  if (translation?.translatedTitle) {
    if (shouldUseChineseContentFallback(translation.translatedTitle, chineseTranslatedContent)) {
      return derivedChineseTitle || getLocalizedFallbackTitle({
        topic: article.topic,
        stage: article.stage,
        categoryName: article.category?.name,
      });
    }
    return translation.translatedTitle;
  }

  if (derivedChineseTitle) {
    return derivedChineseTitle;
  }

  const rawTitle = article.title || '';
  if (!isGenericForeignTitle(rawTitle)) {
    return rawTitle || '权威参考';
  }

  return getLocalizedFallbackTitle({
    topic: article.topic,
    stage: article.stage,
    categoryName: article.category?.name,
  });
}

export function getKnowledgeFallbackSummary(article: KnowledgeArticleLike): string {
  const source = normalizeKnowledgeLabel(article.sourceOrg || article.source) || '权威机构';
  const stage = getKnowledgeStageLabel(article.stage, '全阶段');
  const topic = normalizeKnowledgeLabel(article.topic);
  const audience = normalizeKnowledgeLabel(article.audience);
  const category = article.category ? normalizeKnowledgeLabel(article.category.name) : '';
  const focus = topic || audience || category || '当前阶段重点';
  const stagePrefix = stage !== '全阶段' ? `${stage}阶段` : '当前阶段';
  return `${source}相关原文正在准备中文辅助阅读，这篇内容聚焦${stagePrefix}的${focus}，可先查看导读要点，再按需打开机构原文。`;
}

export function getKnowledgeDisplaySummary(article: KnowledgeArticleLike, fallback?: string): string {
  const chineseTranslatedContent = getChineseTranslatedContent(article);
  const derivedChineseSummary = deriveChineseSummaryFromTranslatedContent(
    chineseTranslatedContent,
    deriveChineseTitleFromTranslatedContent(chineseTranslatedContent),
  );
  const displaySummary = sanitizeTranslationText(article.displaySummary, 'summary');
  if (displaySummary) {
    if (shouldUseChineseContentFallback(displaySummary, chineseTranslatedContent)) {
      return derivedChineseSummary || fallback || '围绕当前阶段整理出的权威知识要点，可进入详情继续阅读来源与正文。';
    }
    return compactTranslationSummary(displaySummary);
  }

  const translation = normalizeKnowledgeArticleTranslation(article.translation);
  if (translation?.translatedSummary) {
    if (shouldUseChineseContentFallback(translation.translatedSummary, chineseTranslatedContent)) {
      return derivedChineseSummary || fallback || '围绕当前阶段整理出的权威知识要点，可进入详情继续阅读来源与正文。';
    }
    return compactTranslationSummary(translation.translatedSummary);
  }

  if (derivedChineseSummary) {
    return derivedChineseSummary;
  }

  return compactTranslationSummary(article.summary, fallback) || fallback || '围绕当前阶段整理出的权威知识要点，可进入详情继续阅读来源与正文。';
}

function firstReadableSentence(input?: string, maxLength = 88): string {
  const text = normalizePlainText(input);
  if (!text) return '';

  const sentence = text.match(/[^。！？!?；;]+[。！？!?；;]?/u)?.[0]?.trim() || text;
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength).trim()}...` : sentence;
}

function extractHeadingCandidates(content?: string): string[] {
  const raw = content || '';
  const htmlHeadings = Array.from(raw.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi))
    .map((match) => normalizePlainText(match[1]))
    .filter(Boolean);

  const textHeadings = stripHtmlTags(raw)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => (
      line.length >= 2
      && line.length <= 28
      && /^(第[一二三四五六七八九十百千万0-9]+[章节部分篇条]|[一二三四五六七八九十]+[、.．]|[0-9]+[、.．]|（[一二三四五六七八九十0-9]+）|提示|建议|结论|原因|措施|何时就医|参考来源)/u.test(line)
    ));

  return Array.from(new Set([...htmlHeadings, ...textHeadings])).slice(0, 3);
}

interface ReadableLength {
  count: number;
  unit: '字' | '词';
}

const CHINESE_READING_CHARS_PER_MINUTE = 600;
const ENGLISH_READING_WORDS_PER_MINUTE = 220;

function countReadableLength(input?: string): ReadableLength {
  const plainText = stripHtmlTags(input || '')
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plainText) {
    return { count: 0, unit: '字' };
  }

  const cjkChars = plainText.match(/[\u3400-\u4dbf\u4e00-\u9fff]/gu)?.length || 0;
  const latinWords = plainText.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g)?.length || 0;
  const numberGroups = plainText.match(/\b\d+(?:[.,]\d+)*\b/g)?.length || 0;

  if (cjkChars > 0) {
    return {
      count: cjkChars + latinWords + numberGroups,
      unit: '字',
    };
  }

  if (latinWords > 0 || numberGroups > 0) {
    return {
      count: latinWords + numberGroups,
      unit: '词',
    };
  }

  return {
    count: plainText.replace(/[^\p{L}\p{N}]/gu, '').length,
    unit: '字',
  };
}

function normalizePositiveInteger(value: unknown): number {
  const numberValue = typeof value === 'number' ? value : Number.parseFloat(String(value || ''));
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(numberValue));
}

function resolveSuppliedReadingTime(article?: KnowledgeArticleLike | null): number {
  return normalizePositiveInteger(article?.readingTime)
    || normalizePositiveInteger(article?.readTime)
    || normalizePositiveInteger(article?.read_time);
}

function resolveSuppliedReadableLength(article?: KnowledgeArticleLike | null): ReadableLength {
  const readableTextLength = normalizePositiveInteger(article?.readableTextLength);
  if (readableTextLength > 0) {
    return {
      count: readableTextLength,
      unit: article?.readableTextUnit === '词' ? '词' : '字',
    };
  }

  const characterCount = normalizePositiveInteger(article?.characterCount);
  if (characterCount > 0) {
    return { count: characterCount, unit: '字' };
  }

  const wordCount = normalizePositiveInteger(article?.wordCount);
  if (wordCount > 0) {
    return { count: wordCount, unit: '词' };
  }

  return { count: 0, unit: '字' };
}

function estimateReadingMinutes(length: ReadableLength): number {
  if (length.count <= 0) {
    return 0;
  }

  const speed = length.unit === '词'
    ? ENGLISH_READING_WORDS_PER_MINUTE
    : CHINESE_READING_CHARS_PER_MINUTE;
  return Math.max(1, Math.ceil(length.count / speed));
}

function formatLengthLabel(length: ReadableLength, contentMode: 'body' | 'summary' | 'empty'): string {
  if (contentMode === 'empty' || length.count <= 0) {
    return '正文待同步';
  }

  const prefix = contentMode === 'summary' ? '摘要约 ' : '约 ';
  if (length.count >= 10000 && length.unit === '字') {
    return `${prefix}${(length.count / 10000).toFixed(1)} 万字`;
  }

  if (length.count >= 1000) {
    return `${prefix}${Math.round(length.count / 100) * 100} ${length.unit}`;
  }

  return `${prefix}${Math.max(length.count, 1)} ${length.unit}`;
}

function countSections(input?: string): number {
  const raw = input || '';
  if (!raw.trim()) {
    return 0;
  }

  const htmlCount = Array.from(raw.matchAll(/<h[1-3]\b[^>]*>[\s\S]*?<\/h[1-3]>/gi)).length;
  if (htmlCount > 0) {
    return htmlCount;
  }

  return stripHtmlTags(raw)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => (
      line.length >= 2
      && line.length <= 28
      && /^(第[一二三四五六七八九十百千万0-9]+[章节部分篇条]|[一二三四五六七八九十]+[、.．]|[0-9]+[、.．]|（[一二三四五六七八九十0-9]+）|提示|建议|结论|原因|措施|何时就医|参考来源)/u.test(line)
    )).length;
}

export function buildKnowledgeReadingMeta(article?: KnowledgeArticleLike | null): KnowledgeReadingMeta {
  const bodyLength = countReadableLength(article?.content);
  const summaryLength = countReadableLength(article?.summary);
  const suppliedLength = resolveSuppliedReadableLength(article);
  const contentMode = bodyLength.count > 0 || suppliedLength.count > 0
    ? 'body'
    : (summaryLength.count > 0 ? 'summary' : 'empty');
  const effectiveLength = bodyLength.count > 0
    ? bodyLength
    : (suppliedLength.count > 0 ? suppliedLength : summaryLength);
  const effectiveCount = effectiveLength.count;
  const suppliedMinutes = resolveSuppliedReadingTime(article);
  const estimatedMinutes = suppliedMinutes || estimateReadingMinutes(effectiveLength);
  const sectionCount = countSections(bodyLength.count > 0 ? article?.content : article?.summary);

  return {
    estimatedMinutes,
    estimatedMinutesLabel: estimatedMinutes > 0 ? `约 ${estimatedMinutes} 分钟` : '待同步',
    textLength: effectiveCount,
    textLengthLabel: formatLengthLabel(effectiveLength, contentMode),
    sectionCount,
    sectionLabel: sectionCount > 0
      ? `${sectionCount} 个章节`
      : contentMode === 'empty'
        ? '等待正文'
        : contentMode === 'summary'
        ? '摘要阅读'
        : '连续阅读',
    contentMode: contentMode === 'empty' ? 'summary' : contentMode,
    contentModeLabel: contentMode === 'body' ? '正文阅读' : (contentMode === 'empty' ? '正文待同步' : '摘要阅读'),
  };
}

export function buildKnowledgeVariantPreview(article?: KnowledgeArticleLike | null): KnowledgeVariantPreview {
  const sourceLabel = article ? getKnowledgeSourceLabel(article) : '权威内容';
  const readingMeta = buildKnowledgeReadingMeta(article);
  const updatedLabel = article ? `更新 ${formatKnowledgeDisplayDate(article)}` : '最近同步';
  const chips = [
    article ? getKnowledgeSourceSignal(article) : '权威源',
    updatedLabel,
    readingMeta.textLengthLabel,
  ];

  if (article?.audience) {
    chips.push(`适用 ${normalizeKnowledgeLabel(article.audience)}`);
  }

  return {
    sourceLabel,
    chips,
  };
}

export function buildKnowledgeSourceDigest(articles: Array<KnowledgeArticleLike | null | undefined>): KnowledgeSourceDigest {
  const normalizedArticles = articles.filter((article): article is KnowledgeArticleLike => Boolean(article));
  const sourceLabels = Array.from(new Set(
    normalizedArticles
      .map((article) => getKnowledgeSourceLabel(article))
      .filter(Boolean),
  ));
  const chineseCount = normalizedArticles.filter((article) => isChineseKnowledgeArticle(article)).length;
  const totalCount = normalizedArticles.length;
  const sourceCount = sourceLabels.length;
  const previewLabels = sourceLabels.slice(0, 3);
  const remainingCount = Math.max(sourceLabels.length - previewLabels.length, 0);
  const sourceSummary = previewLabels.join(' / ');
  const description = sourceSummary
    ? `当前包含 ${sourceSummary}${remainingCount > 0 ? ` 等 ${sourceLabels.length} 个机构来源` : ''}。`
    : '当前已按机构来源聚合展示。';

  return {
    sourceLabels,
    sourceCount,
    chineseCount,
    totalCount,
    summaryLabel: `机构 ${sourceCount} 个 · 中文源 ${chineseCount}/${totalCount || 1}`,
    description,
  };
}

export function buildKnowledgeVariantReadingSuggestion(
  articles: Array<KnowledgeArticleLike | null | undefined>,
): KnowledgeVariantReadingSuggestion {
  const normalizedArticles = articles.filter((article): article is KnowledgeArticleLike => Boolean(article));
  const chineseCount = normalizedArticles.filter((article) => isChineseKnowledgeArticle(article)).length;
  const totalCount = normalizedArticles.length;
  const foreignCount = Math.max(totalCount - chineseCount, 0);
  const sourceCount = new Set(
    normalizedArticles
      .map((article) => getKnowledgeSourceLabel(article))
      .filter(Boolean),
  ).size;

  if (chineseCount > 0 && foreignCount > 0) {
    return {
      label: '建议先看中文源，再核对国际原文',
      description: sourceCount > 1
        ? '先用中文版本建立基本判断，再按需对照不同机构的更新时间和原文表述差异。'
        : '先看中文版本快速建立判断，再按需切到国际原文核对细节和更新时间。',
    };
  }

  if (chineseCount > 0 && totalCount > 1) {
    return {
      label: '建议先看中文版本',
      description: '当前可先读中文版本，再按更新时间切换到其他同源版本补充细节。',
    };
  }

  if (sourceCount > 1 && totalCount > 1) {
    return {
      label: '建议先看最近版本，再交叉核对机构表述',
      description: '当前包含多个机构来源，先读最近版本，再留意不同机构对适用对象和风险边界的表述差异。',
    };
  }

  if (totalCount > 1) {
    return {
      label: '建议先看最近版本',
      description: '当前可先读最近同步版本，再按摘要长短决定是否切到其他版本补充细节。',
    };
  }

  return {
    label: '建议先看摘要再读正文',
    description: '先用摘要判断是否匹配当前阶段，再决定是否继续细读正文与来源链接。',
  };
}

export function buildKnowledgeVariantSortFeedback(
  articles: Array<KnowledgeArticleLike | null | undefined>,
  mode: KnowledgeVariantSortMode,
): KnowledgeVariantSortFeedback | null {
  const normalizedArticles = articles.filter((article): article is KnowledgeArticleLike => Boolean(article));
  const firstArticle = normalizedArticles[0];
  if (!firstArticle) {
    return null;
  }

  const firstSourceLabel = getKnowledgeSourceLabel(firstArticle);
  const firstDateLabel = formatKnowledgeDisplayDate(firstArticle);

  if (mode === 'recent') {
    return {
      label: '已按最近更新排序',
      description: `当前优先展示 ${firstSourceLabel} 版本，更新于 ${firstDateLabel}。`,
    };
  }

  if (mode === 'zhFirst') {
    return isChineseKnowledgeArticle(firstArticle)
      ? {
          label: '已按中文优先排序',
          description: `中文版本已排在前面，可先看 ${firstSourceLabel}，再决定是否切到国际原文核对细节。`,
        }
      : {
          label: '当前没有中文版本',
          description: `当前可见版本仍以 ${firstSourceLabel} 开始，建议重点核对更新时间和机构原文。`,
        };
  }

  return {
    label: '已按推荐顺序排序',
    description: `摘要更完整、阅读门槛更低的版本会排前，当前首条为 ${firstSourceLabel}。`,
  };
}

export function buildKnowledgeReadingPath(article?: KnowledgeArticleLike | null): KnowledgeReadingPath {
  const source = article ? getKnowledgeSourceLabel(article) : '权威来源';
  const topic = normalizeKnowledgeLabel(article?.topic);
  const stage = getKnowledgeStageLabel(article?.stage, '');
  const focus = topic || article?.category?.name || stage || '当前主题';
  const summaryLead = firstReadableSentence(article?.summary);
  const headingCandidates = extractHeadingCandidates(article?.content);
  const bodyLead = firstReadableSentence(article?.content, 72);
  const items: KnowledgeReadingPathItem[] = [];

  items.push({
    title: '先看核心摘要',
    description: summaryLead || `先确认这篇内容是否聚焦${focus}，再决定是否继续细读正文。`,
  });

  items.push({
    title: '再核对来源',
    description: `${source}内容优先看更新时间、适用对象和原文链接，避免把过期资料直接套用。`,
  });

  if (headingCandidates.length > 0) {
    items.push({
      title: '按章节细读',
      description: headingCandidates.join(' / '),
    });
  } else {
    items.push({
      title: '进入正文细读',
      description: bodyLead || '正文会按段落和列表重新排版，适合逐段核对建议、风险信号和操作边界。',
    });
  }

  items.push({
    title: '最后判断行动',
    description: /用药|剂量|治疗|急|出血|发热|呼吸困难|抽搐/u.test(normalizePlainText(`${article?.title || ''} ${article?.summary || ''} ${article?.content || ''}`))
      ? '涉及急性症状、用药或治疗方案时，应优先联系医生或线下就医。'
      : '如果与你的阶段或症状不完全匹配，先收藏并核对原始来源，不要直接替代线下专业判断。',
  });

  return {
    kicker: '阅读路径',
    title: `${focus}怎么读`,
    description: stage ? `按${stage}场景整理阅读顺序。` : '按摘要、来源、正文、行动四步阅读。',
    items,
  };
}

export function isSourceLikeKnowledgeTag(label: string): boolean {
  const normalized = normalizeKnowledgeLabel(label);
  if (!normalized) return false;

  const knownOrgs = new Set([
    '美国儿科学会',
    '梅奥诊所',
    'MSD 诊疗手册',
    '英国国民保健署',
    '世界卫生组织',
    '美国疾控中心',
    '美国妇产科医师学会',
  ]);

  if (knownOrgs.has(normalized)) return true;

  const lower = normalized.toLowerCase();
  return /healthychildren|mayoclinic|msdmanuals|who\.int|cdc\.gov|nhs\.uk|acog\.org/i.test(lower)
    || /american academy of pediatrics|american college of obstetricians and gynecologists|world health organization|national health service|centers? for disease control/i.test(lower);
}

export function shouldHideAuthorityCategoryChip(article: KnowledgeArticleLike): boolean {
  if (!article.category) return false;
  if (article.category.slug === 'authority-source') return true;

  const categoryKey = normalizeKnowledgeLabel(article.category.name).toLowerCase();
  const sourceKey = normalizeKnowledgeLabel(article.sourceOrg || article.source).toLowerCase();
  return Boolean(categoryKey && sourceKey && categoryKey === sourceKey);
}

export function getKnowledgeDisplayTags<T extends KnowledgeTagLike>(article?: KnowledgeArticleLike | null): Array<T & { displayName: string }> {
  if (!article?.tags?.length) return [];

  const seen = new Set<string>();
  const sourceKey = normalizeKnowledgeLabel(article.sourceOrg || article.source).toLowerCase();
  const topicKey = normalizeKnowledgeLabel(article.topic).toLowerCase();

  return article.tags
    .map((tag) => ({
      ...(tag as T),
      displayName: normalizeKnowledgeLabel(tag.name),
    }))
    .filter((tag) => {
      const key = tag.displayName.toLowerCase();
      if (!key) return false;
      if (key === sourceKey || key === topicKey) return false;
      if (isSourceLikeKnowledgeTag(key)) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function parseSourceHttpUrl(url?: string): ParsedSourceUrl | null {
  const trimmedUrl = (url || '').trim();
  if (!trimmedUrl || /[\s<>"'`]/u.test(trimmedUrl)) {
    return null;
  }

  const match = trimmedUrl.match(/^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/iu);
  const hostname = match?.[2]?.trim() || '';
  if (!match || !hostname || hostname.includes('@')) {
    return null;
  }

  const pathname = match[3] || '/';
  const readablePath = [
    pathname === '/' ? '' : pathname.replace(/\/+$/g, ''),
    match[4] || '',
    match[5] || '',
  ].join('');

  return {
    normalizedUrl: trimmedUrl,
    hostname: hostname.toLowerCase(),
    pathname,
    readablePath,
  };
}

export function normalizeAuthoritySourceUrl(url?: string): string {
  return parseSourceHttpUrl(url)?.normalizedUrl || '';
}

function getKnowledgeReferenceUrlCandidates(references: unknown): unknown[] {
  if (!Array.isArray(references)) {
    return [];
  }

  return references.flatMap((reference) => {
    if (!reference || typeof reference !== 'object') {
      return [];
    }

    const item = reference as KnowledgeSourceReferenceLike;
    return [item.sourceUrl, item.source_url, item.url, item.link];
  });
}

export function resolveKnowledgeSourceUrl(article?: KnowledgeArticleLike | null): string {
  if (!article) {
    return '';
  }

  const candidates: unknown[] = [
    article.sourceUrl,
    article.source_url,
    article.url,
    article.originalId,
    article.original_id,
    article.source,
    ...getKnowledgeReferenceUrlCandidates(article.references),
  ];

  for (const candidate of candidates) {
    const sourceUrl = typeof candidate === 'string'
      ? normalizeAuthoritySourceUrl(candidate)
      : '';
    if (sourceUrl) {
      return sourceUrl;
    }
  }

  return '';
}

export function sanitizeAuthoritySourceUrl(url?: string, sourceText = ''): string {
  const normalizedUrl = normalizeAuthoritySourceUrl(url);
  if (!normalizedUrl) {
    return '';
  }

  const parsedUrl = parseSourceHttpUrl(normalizedUrl);
  if (!parsedUrl) {
    return '';
  }
  const pathname = parsedUrl.pathname.toLowerCase().replace(/\/+$/g, '') || '/';

  const normalizedSource = `${sourceText} ${normalizedUrl}`.toLowerCase();
  const exactLandingPaths = new Set([
    '/',
    '/news-room',
    '/health-topics',
    '/health-topics/maternal-health',
    '/health-topics/child-health',
    '/health-topics/breastfeeding',
    '/health-topics/vaccines-and-immunization',
    '/pregnancy',
    '/breastfeeding',
    '/parents',
    '/child-development',
    '/vaccines-children',
    '/vaccines-pregnancy',
    '/vaccines-for-children',
    '/reproductivehealth',
    '/womens-health',
    '/contraception',
    '/growthcharts',
    '/ncbddd',
    '/act-early',
    '/early-care',
    '/protect-children',
    '/medicines-and-pregnancy',
    '/opioid-use-during-pregnancy',
    '/pregnancy-hiv-std-tb-hepatitis',
    '/english/ages-stages',
    '/english/health-issues',
    '/english/healthy-living',
    '/english/safety-prevention',
    '/english/family-life',
    '/clinical',
    '/topics',
    '/conditions',
    '/conditions/baby',
    '/conditions/pregnancy-and-baby',
    '/medicines',
    '/vaccinations',
    '/start-for-life',
  ]);

  if (exactLandingPaths.has(pathname)) {
    return '';
  }

  if (/chinacdc|中国疾病预防控制中心/u.test(normalizedSource)) {
    if (pathname === '/' || pathname.endsWith('/list.html') || !/(?:\/t\d{8}_\d+\.(?:html?|shtml)|\.pdf(?:$|[?#]))/i.test(normalizedUrl)) {
      return '';
    }
  }

  if (/ndcpa|国家疾病预防控制局/u.test(normalizedSource)) {
    if (pathname === '/' || pathname.endsWith('/list.html') || !/\/common\/content\/content_\d+\.html(?:$|[?#])/i.test(normalizedUrl)) {
      return '';
    }
  }

  return normalizedUrl;
}

export function toReadableUrl(url: string): string {
  const parsedUrl = parseSourceHttpUrl(url);
  if (!parsedUrl) {
    return url;
  }

  return `${parsedUrl.hostname}${parsedUrl.readablePath}`.slice(0, 88);
}

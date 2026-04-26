import {
  formatKnowledgeStageLabel,
  formatSourceLabel,
  getLocalizedFallbackTitle,
  isGenericForeignTitle,
  normalizePlainText,
  stripHtmlTags,
} from './knowledge-text';
import type { KnowledgeVariantSortMode } from './knowledge-dedupe';

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
  sourceOrg?: string;
  source?: string;
  region?: string;
  sourceUrl?: string;
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
  return article.sourceLanguage === 'zh' || article.sourceLocale === 'zh-CN';
}

export function getKnowledgeSourceSignal(article: KnowledgeArticleLike): string {
  return isChineseKnowledgeArticle(article) ? '中文源' : '国际源';
}

export function getKnowledgeDisplayTitle(article: KnowledgeArticleLike): string {
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
  return normalizePlainText(article.summary) || fallback || '围绕当前阶段整理出的权威知识要点，可进入详情继续阅读来源与正文。';
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

function countReadableChars(input?: string): number {
  const plainText = stripHtmlTags(input || '')
    .replace(/\s+/g, '')
    .trim();

  return plainText.length;
}

function formatLengthLabel(charCount: number): string {
  if (charCount >= 10000) {
    return `约 ${(charCount / 10000).toFixed(1)} 万字`;
  }

  if (charCount >= 1000) {
    return `约 ${Math.round(charCount / 100) * 100} 字`;
  }

  return `约 ${Math.max(charCount, 1)} 字`;
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
  const bodyChars = countReadableChars(article?.content);
  const summaryChars = countReadableChars(article?.summary);
  const contentMode = bodyChars > 0 ? 'body' : 'summary';
  const effectiveChars = bodyChars || summaryChars || 1;
  const estimatedMinutes = Math.max(1, Math.ceil(effectiveChars / 420));
  const sectionCount = countSections(bodyChars > 0 ? article?.content : article?.summary);

  return {
    estimatedMinutes,
    estimatedMinutesLabel: `约 ${estimatedMinutes} 分钟`,
    textLength: effectiveChars,
    textLengthLabel: formatLengthLabel(effectiveChars),
    sectionCount,
    sectionLabel: sectionCount > 0
      ? `${sectionCount} 个章节`
      : contentMode === 'summary'
        ? '摘要阅读'
        : '连续阅读',
    contentMode,
    contentModeLabel: contentMode === 'body' ? '正文阅读' : '摘要阅读',
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
      : '如果与你的阶段或症状不完全匹配，先收藏或追问，不要直接替代医生判断。',
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

export function sanitizeAuthoritySourceUrl(url?: string, sourceText = ''): string {
  if (!url) {
    return '';
  }

  let pathname = '';
  try {
    pathname = new URL(url).pathname.toLowerCase().replace(/\/+$/g, '') || '/';
  } catch {
    return '';
  }

  const normalizedSource = `${sourceText} ${url}`.toLowerCase();
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
    if (pathname === '/' || pathname.endsWith('/list.html') || !/(?:\/t\d{8}_\d+\.(?:html?|shtml)|\.pdf(?:$|[?#]))/i.test(url)) {
      return '';
    }
  }

  if (/ndcpa|国家疾病预防控制局/u.test(normalizedSource)) {
    if (pathname === '/' || pathname.endsWith('/list.html') || !/\/common\/content\/content_\d+\.html(?:$|[?#])/i.test(url)) {
      return '';
    }
  }

  return url;
}

export function toReadableUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/g, '');
    return `${parsed.hostname}${pathname}`.slice(0, 88);
  } catch {
    return url;
  }
}

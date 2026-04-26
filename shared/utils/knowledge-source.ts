export type KnowledgeSourceLike = {
  sourceLanguage?: string;
  sourceLocale?: string;
  region?: string;
  sourceOrg?: string;
  source?: string;
  sourceUrl?: string;
  url?: string;
};

const CHINESE_AUTHORITY_PATTERNS = [
  /中国政府网/u,
  /国家卫生健康委员会/u,
  /国家卫健委/u,
  /国家疾病预防控制局/u,
  /国家疾控局/u,
  /中国疾病预防控制中心/u,
  /中国疾控/u,
  /妇幼健康司/u,
  /人口监测与家庭发展司/u,
  /gov\.cn/i,
  /nhc\.gov\.cn/i,
  /chinacdc\.cn/i,
  /ndcpa\.gov\.cn/i,
  /msdmanuals\.cn/i,
  /\/zh(?:[-_/]|$)/i,
  /chinese/i,
];

export function isChineseKnowledgeSource(source?: KnowledgeSourceLike | null): boolean {
  if (!source) {
    return false;
  }

  const language = (source.sourceLanguage || '').toLowerCase();
  const locale = (source.sourceLocale || '').toLowerCase();
  const region = (source.region || '').toUpperCase();

  if (language === 'zh' || language.startsWith('zh-')) {
    return true;
  }

  if (locale === 'zh' || locale.startsWith('zh-') || locale.startsWith('zh_')) {
    return true;
  }

  if (region === 'CN') {
    return true;
  }

  const sourceText = [
    source.sourceOrg || '',
    source.source || '',
    source.sourceUrl || '',
    source.url || '',
  ].join(' ');

  return CHINESE_AUTHORITY_PATTERNS.some((pattern) => pattern.test(sourceText));
}

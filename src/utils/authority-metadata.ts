export function normalizeAuthorityTopicLabel(topic?: string | null): string {
  const value = String(topic || '').trim().toLowerCase();
  if (!value) return '';

  const mapping: Record<string, string> = {
    pregnancy: '孕期',
    postpartum: '产后恢复',
    newborn: '新生儿',
    feeding: '喂养',
    vaccination: '疫苗',
    development: '成长发育',
    'common-symptoms': '常见症状',
    policy: '指南/政策',
    general: '母婴知识',
  };

  return mapping[value] || String(topic).trim();
}

export function normalizeAuthorityAudienceLabel(audience?: string | null): string {
  const value = String(audience || '').trim();
  if (!value) return '';

  const mapping: Record<string, string> = {
    '备孕女性': '备孕家庭',
    '产后女性': '产后妈妈',
    '母婴家庭': '母婴家庭',
    '孕妇': '孕妇',
    '产后妈妈': '产后妈妈',
    '新生儿家长': '新生儿家长',
    '婴儿家长': '婴儿家长',
    '婴幼儿家长': '婴幼儿家长',
    '幼儿家长': '幼儿家长',
    '学龄前儿童家长': '学龄前儿童家长',
  };

  return mapping[value] || value;
}

export function buildAuthorityDisplayTags(input: {
  topic?: string | null;
  audience?: string | null;
  tags?: Array<string | null | undefined>;
  sourceOrg?: string | null;
  limit?: number;
}): string[] {
  const normalizedSource = String(input.sourceOrg || '').trim().toLowerCase();
  const candidates = [
    normalizeAuthorityTopicLabel(input.topic),
    normalizeAuthorityAudienceLabel(input.audience),
    ...(input.tags || []).map((tag) => {
      const normalizedTopic = normalizeAuthorityTopicLabel(tag);
      return normalizedTopic !== String(tag || '').trim()
        ? normalizedTopic
        : normalizeAuthorityAudienceLabel(tag);
    }),
  ];

  const seen = new Set<string>();
  const output: string[] = [];

  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (!value) continue;

    const key = value.toLowerCase();
    if (key === normalizedSource) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);

    if (output.length >= (input.limit || 6)) {
      break;
    }
  }

  return output;
}

export function isChineseAuthorityArticle(input: {
  sourceLanguage?: string | null;
  sourceLocale?: string | null;
  region?: string | null;
  sourceOrg?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  url?: string | null;
}): boolean {
  const language = String(input.sourceLanguage || '').toLowerCase();
  const locale = String(input.sourceLocale || '').toLowerCase();
  const region = String(input.region || '').toUpperCase();

  if (language === 'zh' || language.startsWith('zh-')) return true;
  if (locale === 'zh' || locale.startsWith('zh-') || locale.startsWith('zh_')) return true;
  if (region === 'CN') return true;

  const sourceText = [
    input.sourceOrg || '',
    input.source || '',
    input.sourceUrl || '',
    input.url || '',
  ].join(' ');

  return [
    /中国政府网/u,
    /国家卫生健康委员会/u,
    /国家卫健委/u,
    /国家疾病预防控制局/u,
    /国家疾控局/u,
    /中国疾病预防控制中心/u,
    /中国疾控/u,
    /gov\.cn/i,
    /nhc\.gov\.cn/i,
    /chinacdc\.cn/i,
    /ndcpa\.gov\.cn/i,
    /msdmanuals\.cn/i,
    /\/zh(?:[-_/]|$)/i,
    /chinese/i,
  ].some((pattern) => pattern.test(sourceText));
}

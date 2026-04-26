const TOPIC_LABEL_MAP: Record<string, string> = {
  pregnancy: '孕期与产检',
  postpartum: '产后恢复',
  newborn: '新生儿护理',
  feeding: '喂养与辅食',
  vaccination: '疫苗与预防',
  'common-symptoms': '常见症状判断',
  development: '发育与日常照护',
  policy: '政策与官方通知',
  general: '综合资料',
};

const STAGE_LABEL_MAP: Record<string, string> = {
  preparation: '备孕期',
  'first-trimester': '孕早期',
  'second-trimester': '孕中期',
  'third-trimester': '孕晚期',
  postpartum: '产后恢复',
  newborn: '月子/新生儿',
  '0-6-months': '0-6月',
  '6-12-months': '6-12月',
  '1-3-years': '1-3岁',
  '3-years-plus': '3岁+',
};

export type LocalizedFallbackTitleInput = {
  topic?: string;
  stage?: string;
  categoryName?: string;
};

export function formatSourceLabel(label?: string): string {
  const value = (label || '').trim();
  if (!value) {
    return '权威来源';
  }

  const lower = value.toLowerCase();
  if (/american academy of pediatrics|healthychildren\.org|\baap\b/.test(lower)) return '美国儿科学会';
  if (/mayo clinic|mayoclinic\.org/.test(lower)) return '梅奥诊所';
  if (/msd manuals?|msdmanuals\.cn|merck manual/.test(lower)) return 'MSD 诊疗手册';
  if (/national health service|\bnhs\b|nhs\.uk/.test(lower)) return '英国国民保健署';
  if (/world health organization|\bwho\b|who\.int/.test(lower)) return '世界卫生组织';
  if (/centers? for disease control|\bcdc\b|cdc\.gov/.test(lower)) return '美国疾控中心';
  if (/american college of obstetricians and gynecologists|\bacog\b|acog\.org/.test(lower)) return '美国妇产科医师学会';
  if (/国家卫生健康委员会|国家卫健委/.test(value)) return '国家卫健委';
  if (/中国疾病预防控制中心|中国疾控/.test(value)) return '中国疾控';
  if (/国家疾病预防控制局/.test(value)) return '国家疾控局';
  return value;
}

export function formatKnowledgeStageLabel(stage?: string): string {
  if (!stage) {
    return '';
  }

  return STAGE_LABEL_MAP[stage] || stage;
}

export function stripHtmlTags(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h[1-6]|section|article|div)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');
}

export function normalizePlainText(input?: string | null): string {
  return stripHtmlTags(input || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isGenericForeignTitle(title?: string): boolean {
  const value = (title || '').trim();
  if (!value) return false;
  if (/[\u4e00-\u9fff]/u.test(value)) return false;

  const normalized = value.toLowerCase();
  return normalized.length <= 24 && (
    /^(resources?|resource center|article|overview|guide|guidelines|information|faq|factsheet)$/i.test(normalized)
    || /^(recursos?|art[íi]culo|informaci[óo]n|gu[íi]a)$/i.test(normalized)
  );
}

export function isMostlyChineseText(input: string): boolean {
  const text = input.replace(/\s+/g, '');
  if (!text) return false;

  const chineseCount = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;
  const latinCount = (text.match(/[A-Za-z]/g) || []).length;

  if (chineseCount >= 30 && chineseCount >= latinCount) {
    return true;
  }

  return chineseCount / Math.max(text.length, 1) >= 0.2 && chineseCount >= latinCount * 0.6;
}

export function getLocalizedFallbackTitle(
  topicOrInput?: string | LocalizedFallbackTitleInput,
  stage?: string,
): string {
  const input = typeof topicOrInput === 'string'
    ? { topic: topicOrInput, stage }
    : (topicOrInput || {});

  const primary = TOPIC_LABEL_MAP[input.topic || '']
    || input.categoryName?.trim()
    || STAGE_LABEL_MAP[input.stage || '']
    || '权威';

  return `${primary}参考`;
}

// 知识库服务 - 从 JSON 文件读取问答数据并提供轻量检索能力
import fs from 'fs';
import path from 'path';

export interface QAPair {
  id: string;
  content_type?: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  target_stage: string[];
  difficulty: string;
  read_time: number;
  author: {
    name: string;
    title: string;
  };
  is_verified: boolean;
  status: string;
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  published_at: string;
  source: string;
  original_id: string;
}

export interface SourceReference {
  title: string;
  source: string;
  relevance: number;
  url?: string;
  excerpt?: string;
  category?: string;
}

export interface KnowledgeSearchResult extends QAPair {
  score: number;
  sourceReference: SourceReference;
}

const FALLBACK_FOLLOW_UPS = [
  '需要我结合孕周或宝宝月龄进一步细化吗？',
  '如果有检查结果或具体症状，也可以继续补充。',
  '我可以继续帮你梳理日常护理和就医观察重点。',
];

const CATEGORY_FOLLOW_UPS: Partial<Record<QAPair['category'], string[]>> = {
  'pregnancy-early': [
    '要不要结合当前孕周再细化注意事项？',
    '如果有出血、腹痛或检查结果，我可以继续帮你判断观察重点。',
    '需要我补充本周产检或日常护理建议吗？',
  ],
  'pregnancy-mid': [
    '要不要结合当前孕周再细化产检和护理重点？',
    '如果有胎动、宫缩或检查结果，也可以继续补充。',
    '需要我继续整理饮食和休息建议吗？',
  ],
  'pregnancy-late': [
    '如果方便，可以补充现在的孕周、是否单侧水肿或血压情况。',
    '需要我继续整理居家观察重点和何时就医吗？',
    '如果有最近产检结果，我可以继续帮你拆解风险点。',
  ],
  'pregnancy-birth': [
    '需要我继续整理临产信号和待产准备吗？',
    '如果有宫缩频率、见红或破水情况，也可以继续补充。',
    '要不要我帮你区分哪些情况适合继续观察、哪些要尽快去医院？',
  ],
  'parenting-newborn': [
    '如果方便，可以补充宝宝出生天数、体温或吃奶情况。',
    '需要我继续整理新生儿居家护理重点吗？',
    '如果有化验单或医生结论，我可以继续帮你解释。',
  ],
  'parenting-0-1': [
    '如果方便，可以补充宝宝月龄、体温或吃奶精神状态。',
    '需要我继续整理居家护理和观察重点吗？',
    '如果有用药或检查结果，我也可以继续帮你拆解。',
  ],
  'parenting-1-3': [
    '如果方便，可以补充孩子年龄、体温和精神状态。',
    '需要我继续整理家庭护理重点吗？',
    '如果已经看过医生，也可以把诊断或检查结果发我继续看。',
  ],
  'common-symptoms': [
    '如果方便，可以补充持续时间、体温或伴随症状。',
    '需要我继续帮你区分居家观察和就医信号吗？',
    '如果已经做过检查，我可以继续帮你读结果。',
  ],
  'vaccine-reaction': [
    '如果方便，可以补充宝宝年龄、体温变化和最近接种时间。',
    '需要我继续帮你区分常见接种反应和需要就医的信号吗？',
    '如果已经用过退烧药，也可以继续告诉我用药后的体温变化。',
  ],
};

const CATEGORY_HINTS: Array<{ category: string; keywords: string[] }> = [
  { category: 'pregnancy-prep', keywords: ['备孕', '排卵', '同房', '叶酸', '孕前'] },
  { category: 'pregnancy-early', keywords: ['怀孕', '孕早期', '孕吐', 'nt', '建档', '见红', '孕酮'] },
  { category: 'pregnancy-mid', keywords: ['孕中期', '四维', '唐筛', '糖耐', '胎动'] },
  { category: 'pregnancy-late', keywords: ['孕晚期', '宫缩', '水肿', '待产', '破水'] },
  { category: 'pregnancy-birth', keywords: ['分娩', '顺产', '剖宫产', '开宫口', '产后'] },
  { category: 'parenting-newborn', keywords: ['新生儿', '黄疸', '月子', '出生', '脐带'] },
  { category: 'parenting-0-1', keywords: ['宝宝', '婴儿', '母乳', '辅食', '夜醒', '睡眠', '哄睡', '安抚', '奶量', '喂奶', '吃奶', '厌奶', '湿疹', '发烧'] },
  { category: 'parenting-1-3', keywords: ['幼儿', '一岁', '两岁', '断奶', '走路', '说话', '睡眠', '哭闹', '作息'] },
  { category: 'parenting-3-6', keywords: ['学龄前', '入园', '专注力', '社交', '发音'] },
  { category: 'vaccine-schedule', keywords: ['疫苗', '接种', '打针', '疫苗时间'] },
  { category: 'common-symptoms', keywords: ['腹泻', '咳嗽', '拉肚子', '发热', '呕吐', '便秘'] },
  { category: 'common-disease', keywords: ['肺炎', '感冒', '感染', '疾病', '过敏'] },
];

const STOP_TERMS = new Set([
  '什么',
  '怎么',
  '怎么办',
  '需要',
  '注意',
  '一下',
  '请问',
  '问题',
  '描述',
  '情况',
  '最近',
  '出现',
  '有关',
  '是否',
  '这种',
  '这个',
]);

const GENERIC_SEGMENTS = new Set([
  '宝宝',
  '怀孕',
  '需要',
  '注意',
  '什么',
  '请问',
  '怎么',
  '回事',
  '情况',
  '最近',
  '出现',
  '轻微',
]);

const GENERIC_FOLLOW_UP_TAGS = new Set([
  '母婴',
  '育儿',
  '健康',
  '宝宝',
  '婴儿',
  '孩子',
  '儿童',
  '怀孕',
  '孕期',
  '问答',
]);

const QUERY_NOISE_PATTERNS = [
  /问题描述[:：]?/g,
  /需要注意什么/g,
  /需要注意哪些/g,
  /应该注意什么/g,
  /怎么办/g,
  /怎么回事/g,
  /请问/g,
  /想问问/g,
  /想咨询/g,
  /想了解/g,
];

const VACCINE_QUERY_PATTERNS = [
  /疫苗|接种|打针|预防针|卡介|乙肝疫苗|百白破|麻腮风|脊灰/u,
];

const SIGNAL_GROUPS: Array<{
  id: string;
  keywords: string[];
  categoryBoost?: Partial<Record<QAPair['category'], number>>;
  mismatchPenalty?: Partial<Record<QAPair['category'], number>>;
  textBoost?: number;
  missingTextPenalty?: number;
}> = [
  {
    id: 'pregnancy-late',
    keywords: ['孕晚期', '怀孕晚期', '怀孕后期', '怀孕8个月', '8个月', '9个月', '32周', '33周', '34周', '35周', '36周', '37周', '38周', '39周', '40周'],
    categoryBoost: {
      'pregnancy-late': 28,
    },
    mismatchPenalty: {
      'pregnancy-prep': 20,
      'pregnancy-early': 18,
      'pregnancy-mid': 10,
    },
    textBoost: 12,
  },
  {
    id: 'pregnancy-mid',
    keywords: ['孕中期', '怀孕中期', '孕4个月', '孕5个月', '孕6个月', '20周', '21周', '22周', '23周', '24周', '25周', '26周', '27周'],
    categoryBoost: {
      'pregnancy-mid': 24,
    },
    mismatchPenalty: {
      'pregnancy-prep': 18,
      'pregnancy-early': 12,
      'pregnancy-late': 12,
    },
    textBoost: 10,
  },
  {
    id: 'pregnancy-early',
    keywords: ['孕早期', '怀孕初期', '怀孕早期', '刚怀孕', '孕1个月', '孕2个月', '孕3个月', '5周', '6周', '7周', '8周', '9周', '10周', '11周', '12周'],
    categoryBoost: {
      'pregnancy-early': 24,
    },
    mismatchPenalty: {
      'pregnancy-prep': 12,
      'pregnancy-mid': 10,
      'pregnancy-late': 18,
    },
    textBoost: 10,
  },
  {
    id: 'edema',
    keywords: ['水肿', '浮肿', '脚肿', '腿肿', '肿胀'],
    textBoost: 18,
    missingTextPenalty: 18,
  },
  {
    id: 'bleeding',
    keywords: ['出血', '见红', '流血'],
    textBoost: 18,
    missingTextPenalty: 16,
  },
  {
    id: 'fever',
    keywords: ['发烧', '发热', '高烧'],
    textBoost: 16,
    missingTextPenalty: 16,
  },
  {
    id: 'childcare-sleep',
    keywords: ['夜醒', '夜里总醒', '夜间醒', '睡眠', '睡觉', '哄睡', '闹觉', '安抚', '作息', '睡不踏实', '翻来覆去'],
    categoryBoost: {
      'parenting-newborn': 18,
      'parenting-0-1': 26,
      'parenting-1-3': 18,
    },
    mismatchPenalty: {
      'pregnancy-prep': 26,
      'pregnancy-early': 26,
      'pregnancy-mid': 22,
      'pregnancy-late': 22,
      'pregnancy-birth': 18,
    },
    textBoost: 14,
    missingTextPenalty: 24,
  },
  {
    id: 'childcare-feeding',
    keywords: ['奶量', '喂奶', '吃奶', '厌奶', '母乳', '配方奶', '断奶', '辅食'],
    categoryBoost: {
      'parenting-newborn': 20,
      'parenting-0-1': 24,
      'parenting-1-3': 16,
    },
    mismatchPenalty: {
      'pregnancy-prep': 22,
      'pregnancy-early': 22,
      'pregnancy-mid': 18,
      'pregnancy-late': 18,
      'pregnancy-birth': 14,
    },
    textBoost: 12,
    missingTextPenalty: 20,
  },
];

let qaData: QAPair[] = [];
let isLoaded = false;

interface QuerySignals {
  preferredCategories: Set<string>;
  matchedGroups: typeof SIGNAL_GROUPS;
}

function sanitizeQuery(query: string): string {
  let result = query.trim();

  for (const pattern of QUERY_NOISE_PATTERNS) {
    result = result.replace(pattern, ' ');
  }

  return result.replace(/\s+/g, ' ').trim();
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getChineseSegments(text: string): string[] {
  const normalized = text.replace(/[^\u4e00-\u9fa5]/g, '');
  const segments = new Set<string>();

  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= normalized.length - size; index += 1) {
      segments.add(normalized.slice(index, index + size));
    }
  }

  return Array.from(segments).filter(segment => !GENERIC_SEGMENTS.has(segment));
}

function extractSearchTerms(query: string): string[] {
  const normalized = normalizeText(sanitizeQuery(query));
  const latinWords = normalized
    .split(' ')
    .map(word => word.trim())
    .filter(word => word.length >= 2 && !STOP_TERMS.has(word));

  const chineseSegments = getChineseSegments(sanitizeQuery(query));
  const merged = new Set<string>([normalized, ...latinWords, ...chineseSegments]);
  return Array.from(merged)
    .filter(term => term.length >= 2 && !STOP_TERMS.has(term) && !GENERIC_SEGMENTS.has(term))
    .slice(0, 24);
}

function inferPreferredCategories(query: string): Set<string> {
  const preferred = new Set<string>();
  const sanitized = sanitizeQuery(query);

  for (const hint of CATEGORY_HINTS) {
    if (hint.keywords.some(keyword => sanitized.includes(keyword))) {
      preferred.add(hint.category);
    }
  }

  return preferred;
}

function collectQuerySignals(query: string): QuerySignals {
  const sanitized = sanitizeQuery(query);
  const preferredCategories = inferPreferredCategories(query);
  const matchedGroups = SIGNAL_GROUPS.filter(group => (
    group.keywords.some(keyword => sanitized.includes(keyword))
  ));

  return {
    preferredCategories,
    matchedGroups,
  };
}

function resultMatchesSignalKeywords(result: Pick<QAPair, 'question' | 'answer' | 'tags' | 'category'>, keywords: string[]): boolean {
  const rawText = [result.question, result.answer, ...(result.tags || []), result.category].join(' ');
  return keywords.some(keyword => rawText.includes(keyword));
}

function needsFocusedSupplement(results: KnowledgeSearchResult[], signals: QuerySignals): boolean {
  const strictGroups = signals.matchedGroups.filter(group => group.missingTextPenalty);
  if (strictGroups.length === 0 || results.length === 0) {
    return false;
  }

  const headResults = results.slice(0, Math.min(2, results.length));
  return strictGroups.some(group => !headResults.some(result => resultMatchesSignalKeywords(result, group.keywords)));
}

function buildFocusedQuery(query: string, signals: QuerySignals): string | undefined {
  const strictGroups = signals.matchedGroups.filter(group => group.missingTextPenalty);
  if (strictGroups.length === 0) {
    return undefined;
  }

  const expandedTerms = strictGroups
    .flatMap(group => group.keywords.slice(0, 3));

  const mergedTerms = Array.from(new Set([
    sanitizeQuery(query),
    ...expandedTerms,
  ].filter(Boolean)));

  return mergedTerms.join(' ').trim() || undefined;
}

function mergeSearchResults(
  primaryResults: KnowledgeSearchResult[],
  supplementResults: KnowledgeSearchResult[],
  limit: number
): KnowledgeSearchResult[] {
  const merged = new Map<string, KnowledgeSearchResult>();

  for (const result of [...supplementResults, ...primaryResults]) {
    if (!merged.has(result.id)) {
      merged.set(result.id, result);
    }
  }

  return Array.from(merged.values()).slice(0, limit);
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

function hasVaccineIntent(query: string): boolean {
  return VACCINE_QUERY_PATTERNS.some((pattern) => pattern.test(query));
}

function isChildCareQuery(query: string): boolean {
  return /宝宝|婴儿|新生儿|孩子|小孩|幼儿|月龄|个月|岁/u.test(query);
}

function targetsChildCare(qa: QAPair): boolean {
  const questionText = qa.question || '';
  const rawText = `${qa.question} ${qa.answer} ${(qa.tags || []).join(' ')} ${qa.category}`;
  const hasPregnancyIntent = /怀孕|孕妇|胎儿|备孕|分娩/u.test(questionText);

  if (qa.category.startsWith('parenting-')) {
    return !hasPregnancyIntent;
  }

  return !hasPregnancyIntent && (
    /宝宝|婴儿|新生儿|孩子|小孩|幼儿|月龄/u.test(questionText)
    || /母乳|辅食/u.test(rawText)
  );
}

function hasCategoryContentConflict(qa: QAPair): boolean {
  const rawText = `${qa.question} ${qa.answer} ${(qa.tags || []).join(' ')}`;

  if (qa.category.startsWith('parenting-') && /怀孕|孕期|孕妇|分娩|胎儿|乳腺|宫缩/u.test(rawText)) {
    return true;
  }

  if (qa.category.startsWith('pregnancy-') && /宝宝|婴儿|新生儿|幼儿|儿童|孩子|小孩/u.test(rawText)) {
    return true;
  }

  if (qa.category.startsWith('parenting-') && !/宝宝|婴儿|新生儿|孩子|小孩|幼儿|月龄|母乳|辅食/u.test(rawText)) {
    return true;
  }

  if (/^vaccine-/.test(qa.category) && !/疫苗|接种|打针|预防针|卡介|乙肝疫苗|百白破|麻腮风|脊灰/u.test(rawText)) {
    return true;
  }

  return false;
}

function questionMatchesFocus(qa: QAPair, focus: 'fever' | 'sleep' | 'feeding'): boolean {
  const text = qa.question;

  if (focus === 'fever') {
    return /发烧|发热|高烧|退烧/u.test(text);
  }

  if (focus === 'sleep') {
    return /夜醒|夜里总醒|夜间醒|睡眠|睡觉|哄睡|安抚|闹觉|睡不踏实|翻来覆去/u.test(text);
  }

  return /奶量|喂奶|吃奶|厌奶|母乳|配方奶|断奶|辅食/u.test(text);
}

function focusKeywords(focus: 'fever' | 'sleep' | 'feeding'): RegExp {
  if (focus === 'fever') {
    return /发烧|发热|高烧|退烧/u;
  }

  if (focus === 'sleep') {
    return /夜醒|夜里总醒|夜间醒|睡眠|睡觉|哄睡|安抚|闹觉|睡不踏实|翻来覆去/u;
  }

  return /奶量|喂奶|吃奶|厌奶|母乳|配方奶|断奶|辅食/u;
}

function answerMatchesFocus(qa: QAPair, focus: 'fever' | 'sleep' | 'feeding'): boolean {
  const text = `${qa.answer} ${(qa.tags || []).join(' ')} ${qa.category}`;
  return focusKeywords(focus).test(text);
}

function focusMatchesResult(
  qa: Pick<QAPair, 'question' | 'answer' | 'tags' | 'category'>,
  focus: 'fever' | 'sleep' | 'feeding'
): boolean {
  return questionMatchesFocus(qa as QAPair, focus) || answerMatchesFocus(qa as QAPair, focus);
}

function hasQuestionAnswerFocusConflict(qa: QAPair, focus: 'fever' | 'sleep' | 'feeding'): boolean {
  return questionMatchesFocus(qa, focus) && !answerMatchesFocus(qa, focus);
}

const FEVER_EXTRA_SYMPTOMS: Array<{ id: string; pattern: RegExp }> = [
  { id: 'cough', pattern: /咳嗽/u },
  { id: 'runny-nose', pattern: /流鼻涕|鼻塞/u },
  { id: 'vomit', pattern: /呕吐/u },
  { id: 'diarrhea', pattern: /腹泻|拉肚子|拉稀/u },
  { id: 'rash', pattern: /红疹|皮疹|水疱|泡泡/u },
  { id: 'eyes', pattern: /眼屎|眼睛/u },
  { id: 'throat', pattern: /嗓子|咽喉|扁桃体/u },
  { id: 'dehydration', pattern: /脱水/u },
  { id: 'convulsion', pattern: /抽风|惊厥|抽搐/u },
];

const FEVER_SPECIFIC_CONTEXTS: Array<{ id: string; pattern: RegExp }> = [
  { id: 'vaccine', pattern: /疫苗|接种|打针|预防针/u },
  { id: 'encephalitis', pattern: /脑炎/u },
  { id: 'hfmd', pattern: /手足口/u },
  { id: 'pneumonia', pattern: /肺炎|支原体|支气管|扁桃体/u },
  { id: 'rash-disease', pattern: /麻疹|出疹/u },
  { id: 'lymph', pattern: /淋巴结/u },
];

function extractFeverTemperature(text: string): number | undefined {
  const match = text.match(/((?:3[7-9])|(?:4[0-2]))(?:[\.。．](\d))?\s*度/u);
  if (!match) {
    return undefined;
  }

  const integerPart = Number(match[1]);
  const decimalPart = match[2] ? Number(match[2]) / 10 : 0;
  return integerPart + decimalPart;
}

function hasFeverHandlingIntent(text: string): boolean {
  return /怎么办|怎么处理|如何处理|怎么退烧|怎么降温|吃什么退烧药|要不要去医院|该怎么办|先怎么处理/u.test(text);
}

function getMatchedExtraSymptoms(text: string): string[] {
  return FEVER_EXTRA_SYMPTOMS
    .filter(item => item.pattern.test(text))
    .map(item => item.id);
}

function getMatchedFeverContexts(text: string): string[] {
  return FEVER_SPECIFIC_CONTEXTS
    .filter(item => item.pattern.test(text))
    .map(item => item.id);
}

function isStrongFeverQuestionMatch(
  qa: Pick<QAPair, 'question' | 'answer' | 'tags' | 'category'>,
  query: string
): boolean {
  if (!questionMatchesFocus(qa as QAPair, 'fever')) {
    return false;
  }

  if (!hasFeverHandlingIntent(qa.question)) {
    return false;
  }

  if (!/宝宝|婴儿|小孩|孩子/u.test(qa.question)) {
    return false;
  }

  const queryTemperature = extractFeverTemperature(query);
  const questionTemperature = extractFeverTemperature(qa.question);
  if (queryTemperature && questionTemperature !== undefined && Math.abs(queryTemperature - questionTemperature) > 0.8) {
    return false;
  }

  const queryExtraSymptoms = new Set(getMatchedExtraSymptoms(query));
  const unmatchedExtraSymptoms = getMatchedExtraSymptoms(qa.question).filter(item => !queryExtraSymptoms.has(item));
  const queryContexts = new Set(getMatchedFeverContexts(query));
  const unmatchedContexts = getMatchedFeverContexts(qa.question).filter(item => !queryContexts.has(item));
  return unmatchedExtraSymptoms.length === 0 && unmatchedContexts.length === 0;
}

function isUsefulFollowUpTag(tag: string, question: string): boolean {
  const normalized = tag.trim();
  return normalized.length >= 2
    && normalized.length <= 8
    && !GENERIC_FOLLOW_UP_TAGS.has(normalized)
    && !question.includes(normalized);
}

function cleanQuestionTitle(question: string): string {
  const cleaned = question
    .replace(/^问题描述[:：]*/u, '')
    .replace(/^全部症状[:：]*/u, '')
    .replace(/^患者信息[:：][^我你他她它]*?/u, '')
    .replace(/发病时间及原因[:：].*$/u, '')
    .replace(/治疗情况[:：].*$/u, '')
    .replace(/曾经治疗情况及是否有过敏、遗传病史[:：].*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();

  const clauses = cleaned
    .split(/[，,。！？；;!?]/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const firstClause = clauses[0] || cleaned;
  const secondClause = clauses[1];
  const preferSecondClause = /^我怀孕\d|^怀孕\d|^我现在怀孕/u.test(firstClause) && !!secondClause;
  const compact = preferSecondClause ? `${firstClause}，${secondClause}` : (firstClause.length >= 8 ? firstClause : cleaned);

  return compact.slice(0, 32);
}

function buildSourceTitle(qa: QAPair, signals?: QuerySignals): string {
  const cleaned = cleanQuestionTitle(qa.question);
  const titleSignalsText = `${cleaned} ${qa.question}`;
  const sleepFocused = signals?.matchedGroups.some(group => group.id === 'childcare-sleep');
  const feedingFocused = signals?.matchedGroups.some(group => group.id === 'childcare-feeding');
  const feverFocused = signals?.matchedGroups.some(group => group.id === 'fever');

  if (sleepFocused && !/夜醒|夜里总醒|夜间醒|睡眠|睡觉|哄睡|安抚|闹觉|睡不踏实|翻来覆去/u.test(titleSignalsText)) {
    return '婴幼儿睡眠安抚参考';
  }

  if (feedingFocused && !/奶量|喂奶|吃奶|厌奶|母乳|配方奶|断奶|辅食/u.test(titleSignalsText)) {
    return '婴幼儿喂养护理参考';
  }

  if (feverFocused && !/发烧|发热|高烧|退烧/u.test(titleSignalsText) && qa.category.startsWith('parenting-')) {
    return '宝宝发热护理参考';
  }

  if (cleaned.length >= 8 && !hasCategoryContentConflict(qa)) {
    return cleaned;
  }

  const categoryLabels: Partial<Record<QAPair['category'], string>> = {
    'pregnancy-early': '孕早期相关参考',
    'pregnancy-mid': '孕中期相关参考',
    'pregnancy-late': '孕晚期相关参考',
    'pregnancy-birth': '分娩相关参考',
    'parenting-newborn': '新生儿护理参考',
    'parenting-0-1': '婴儿护理参考',
    'parenting-1-3': '幼儿护理参考',
    'common-symptoms': '常见症状参考',
  };

  return categoryLabels[qa.category] || '相关知识参考';
}

function buildSourceReference(qa: QAPair, score: number, signals?: QuerySignals): SourceReference {
  return {
    title: buildSourceTitle(qa, signals),
    source: qa.source || '知识库',
    relevance: clampScore(score / 100),
    excerpt: qa.answer.replace(/\s+/g, ' ').slice(0, 120),
    category: qa.category,
  };
}

function reorderFocusedResults(
  results: KnowledgeSearchResult[],
  signals: QuerySignals,
  query: string,
  limit: number
): KnowledgeSearchResult[] {
  const FOCUS_PROMOTION_MAX_SCORE_GAP = 12;
  const feverFocused = signals.matchedGroups.some(group => group.id === 'fever');
  const sleepFocused = signals.matchedGroups.some(group => group.id === 'childcare-sleep');
  const feedingFocused = signals.matchedGroups.some(group => group.id === 'childcare-feeding');

  let focus: 'fever' | 'sleep' | 'feeding' | undefined;
  if (sleepFocused) {
    focus = 'sleep';
  } else if (feedingFocused) {
    focus = 'feeding';
  } else if (feverFocused) {
    focus = 'fever';
  }

  if (!focus) {
    return results.slice(0, limit);
  }

  const vaccineIntent = hasVaccineIntent(query);
  const focused = results.filter((result) => {
    if (!focusMatchesResult(result, focus!)) {
      return false;
    }

    if (hasCategoryContentConflict(result)) {
      return false;
    }

    if (hasQuestionAnswerFocusConflict(result, focus!) && !(focus === 'fever' && isStrongFeverQuestionMatch(result, query))) {
      return false;
    }

    if (focus === 'fever' && !vaccineIntent && /^vaccine-/.test(result.category)) {
      return false;
    }

    if ((focus === 'sleep' || focus === 'feeding') && !vaccineIntent && /^vaccine-/.test(result.category)) {
      return false;
    }

    if (isChildCareQuery(query) && !targetsChildCare(result)) {
      return false;
    }

    return true;
  });

  if (focused.length === 0) {
    return results.slice(0, limit);
  }

  const preferredFocused = focused.filter((result) => (
    signals.preferredCategories.has(result.category)
    || (focus === 'fever' && ['common-symptoms', 'common-disease'].includes(result.category))
  ));

  const rankedFocused = preferredFocused.length > 0 ? preferredFocused : focused;
  const baselineTopScore = results[0]?.score ?? 0;
  const promotableFocused = rankedFocused.filter((result) => (
    baselineTopScore - result.score <= FOCUS_PROMOTION_MAX_SCORE_GAP
  ));

  if (promotableFocused.length === 0) {
    return results.slice(0, limit);
  }

  const merged = new Map<string, KnowledgeSearchResult>();
  for (const result of [...promotableFocused, ...results]) {
    if (!merged.has(result.id)) {
      merged.set(result.id, result);
    }
  }

  return Array.from(merged.values()).slice(0, limit);
}

function calculateScore(
  qa: QAPair,
  query: string,
  normalizedQuery: string,
  terms: string[],
  signals: QuerySignals
): number {
  const normalizedQuestion = normalizeText(qa.question);
  const normalizedAnswer = normalizeText(qa.answer);
  const normalizedTags = normalizeText((qa.tags || []).join(' '));
  const normalizedCategory = normalizeText(qa.category || '');
  const normalizedSource = normalizeText(qa.source || '');
  const rawTagText = (qa.tags || []).join(' ');
  const rawText = [qa.question, qa.answer, rawTagText, qa.category].join(' ');

  let score = 0;

  if (normalizedQuery && normalizedQuestion.includes(normalizedQuery)) {
    score += 40;
  }

  if (normalizedQuery && normalizedAnswer.includes(normalizedQuery)) {
    score += 16;
  }

  for (const term of terms) {
    const questionWeight = Math.min(16, 2 + term.length * 2);
    const answerWeight = Math.min(10, 1 + term.length);
    const tagWeight = Math.min(12, 2 + term.length);
    const categoryWeight = Math.min(10, 1 + term.length);
    const sourceWeight = Math.min(6, Math.max(1, Math.floor(term.length / 2)));

    if (normalizedQuestion.includes(term)) {
      score += questionWeight;
    }
    if (normalizedAnswer.includes(term)) {
      score += answerWeight;
    }
    if (normalizedTags.includes(term)) {
      score += tagWeight;
    }
    if (normalizedCategory.includes(term)) {
      score += categoryWeight;
    }
    if (normalizedSource.includes(term)) {
      score += sourceWeight;
    }
  }

  for (const tag of qa.tags || []) {
    if (tag && query.includes(tag)) {
      score += 12;
    }
  }

  if (signals.preferredCategories.has(qa.category)) {
    score += 14;
  }

  for (const group of signals.matchedGroups) {
    const hasSignalText = group.keywords.some(keyword => rawText.includes(keyword));
    const canUseCategoryBoost = group.missingTextPenalty ? hasSignalText : true;

    if (canUseCategoryBoost && group.categoryBoost?.[qa.category]) {
      score += group.categoryBoost[qa.category] || 0;
    }

    if (group.mismatchPenalty?.[qa.category]) {
      score -= group.mismatchPenalty[qa.category] || 0;
    }

    if (group.textBoost && hasSignalText) {
      score += group.textBoost;
    }

    if (group.missingTextPenalty && !hasSignalText) {
      score -= group.missingTextPenalty;
    }
  }

  if (qa.is_verified) {
    score += 2;
  }

  if ((qa.tags || []).length > 0) {
    score += 1;
  }

  if (hasCategoryContentConflict(qa)) {
    score -= 24;
  }

  const feverFocused = signals.matchedGroups.some(group => group.id === 'fever');
  const sleepFocused = signals.matchedGroups.some(group => group.id === 'childcare-sleep');
  const feedingFocused = signals.matchedGroups.some(group => group.id === 'childcare-feeding');
  const sleepSoothingIntent = /安抚|哄睡|哄/u.test(query);
  const queryTemperature = extractFeverTemperature(query);
  const queryFeverHandlingIntent = hasFeverHandlingIntent(query);
  const queryExtraSymptoms = new Set(getMatchedExtraSymptoms(query));
  const queryFeverContexts = new Set(getMatchedFeverContexts(query));

  if (feverFocused) {
    score += questionMatchesFocus(qa, 'fever') ? 14 : -24;
    if (hasQuestionAnswerFocusConflict(qa, 'fever')) {
      score -= 10;
    }

    const questionTemperature = extractFeverTemperature(qa.question);
    const questionHandlingIntent = hasFeverHandlingIntent(qa.question);
    const extraSymptoms = getMatchedExtraSymptoms(qa.question);
    const unmatchedExtraSymptoms = extraSymptoms.filter(item => !queryExtraSymptoms.has(item));
    const questionContexts = getMatchedFeverContexts(qa.question);
    const unmatchedContexts = questionContexts.filter(item => !queryFeverContexts.has(item));
    const simpleFeverQuestion = questionMatchesFocus(qa, 'fever') && extraSymptoms.length === 0;

    if (queryTemperature && questionTemperature !== undefined) {
      const diff = Math.abs(queryTemperature - questionTemperature);
      if (diff <= 0.2) {
        score += 16;
      } else if (diff <= 0.5) {
        score += 10;
      } else if (diff <= 1) {
        score += 4;
      } else {
        score -= 8;
      }
    }

    if (queryFeverHandlingIntent) {
      if (questionHandlingIntent) {
        score += 12;
      } else {
        score -= 6;
      }
    }

    if (/宝宝|婴儿|小孩|孩子/u.test(qa.question) && !/怀孕|孕妇|成人|大人/u.test(qa.question)) {
      score += 8;
    }

    if (queryExtraSymptoms.size === 0) {
      if (unmatchedExtraSymptoms.length >= 3) {
        score -= 34;
      } else if (unmatchedExtraSymptoms.length === 2) {
        score -= 24;
      } else if (unmatchedExtraSymptoms.length === 1) {
        score -= 14;
      }
    } else if (unmatchedExtraSymptoms.length >= 3) {
      score -= 20;
    } else if (unmatchedExtraSymptoms.length === 2) {
      score -= 12;
    } else if (unmatchedExtraSymptoms.length === 1) {
      score -= 5;
    }

    if (/高烧不退|反复高烧|反复发烧/u.test(qa.question)) {
      score += 6;
    }

    if (queryExtraSymptoms.size === 0 && simpleFeverQuestion) {
      score += 18;
    }

    if (queryExtraSymptoms.size === 0 && questionHandlingIntent && simpleFeverQuestion) {
      score += 10;
    }

    if (/没什么症状|无其他症状|没有其他症状/u.test(qa.question)) {
      score += 10;
    }

    if (queryFeverContexts.size === 0) {
      if (unmatchedContexts.length >= 2) {
        score -= 28;
      } else if (unmatchedContexts.length === 1) {
        score -= 16;
      } else if (simpleFeverQuestion) {
        score += 8;
      }
    }
  }

  if (sleepFocused) {
    score += questionMatchesFocus(qa, 'sleep') ? 16 : -28;
    if (hasQuestionAnswerFocusConflict(qa, 'sleep')) {
      score -= 18;
    }

    if (/夜醒|夜里总醒|睡不踏实|翻来覆去|哄睡|安抚|闹觉/u.test(qa.question)) {
      score += 12;
    }

    if (sleepSoothingIntent) {
      if (/安抚|哄睡|哄/u.test(qa.question)) {
        score += 10;
      } else {
        score -= 6;
      }
    }

    if (/激灵|抽搐|溶血|脑|蛛网膜/u.test(qa.question)) {
      score -= 18;
    }
  }

  if (feedingFocused) {
    score += questionMatchesFocus(qa, 'feeding') ? 14 : -22;
    if (hasQuestionAnswerFocusConflict(qa, 'feeding')) {
      score -= 14;
    }
  }

  if (feverFocused) {
    if (hasVaccineIntent(query)) {
      if (/^vaccine-/.test(qa.category)) {
        score += 14;
      }
    } else {
      if (/^vaccine-/.test(qa.category)) {
        score -= 30;
      }

      if (['common-symptoms', 'common-disease', 'parenting-newborn', 'parenting-0-1', 'parenting-1-3'].includes(qa.category)) {
        score += 10;
      }

      if (/疫苗|接种|打针|预防针/u.test(rawText)) {
        score -= 24;
      }
    }
  }

  if (isChildCareQuery(query)) {
    if (targetsChildCare(qa)) {
      score += 12;
    } else {
      score -= 22;
    }

    if (/怀孕|孕妇|胎儿|备孕|分娩/u.test(rawText) && !/宝宝|婴儿|孩子|小孩/u.test(qa.question)) {
      score -= 28;
    }

    if (/宝宝|婴儿|新生儿|月龄|个月/u.test(qa.question)) {
      score += 8;
    } else if (/孩子|小孩|幼儿/u.test(qa.question)) {
      score += 4;
    }
  }

  if ((sleepFocused || feedingFocused) && !hasVaccineIntent(query) && /^vaccine-/.test(qa.category)) {
    score -= 32;
  }

  return score;
}

function formatContextBlock(results: KnowledgeSearchResult[]): string {
  return results
    .map((qa, index) => {
      return [
        `[${index + 1}] 问题：${buildSourceTitle(qa)}`,
        `答案：${qa.answer}`,
        `分类：${qa.category}`,
        `来源：${qa.source || '知识库'}`,
      ].join('\n');
    })
    .join('\n\n');
}

function buildFollowUpQuestions(question: string, results: KnowledgeSearchResult[]): string[] {
  const candidates = new Set<string>();

  for (const result of results) {
    const categoryTemplates = CATEGORY_FOLLOW_UPS[result.category];
    if (categoryTemplates) {
      for (const candidate of categoryTemplates) {
        candidates.add(candidate);
      }
    }

    for (const tag of result.tags || []) {
      if (tag && isUsefulFollowUpTag(tag, question)) {
        candidates.add(`和“${tag.trim()}”相关还需要注意什么？`);
      }
    }

    if (/水肿|浮肿|脚肿|腿肿/u.test(result.question + result.answer)) {
      candidates.add('水肿是单侧还是双侧？休息后会缓解吗？');
    }

    if (/发烧|发热|高烧/u.test(result.question + result.answer)) {
      candidates.add('现在体温多少？精神状态和进食情况怎么样？');
    }

    if (/出血|见红|流血/u.test(result.question + result.answer)) {
      candidates.add('出血量大吗？颜色和持续时间怎么样？');
    }
  }

  const followUps = Array.from(candidates)
    .filter(candidate => candidate.length >= 6 && candidate !== question.trim())
    .slice(0, 3);

  if (followUps.length >= 3) {
    return followUps;
  }

  for (const fallback of FALLBACK_FOLLOW_UPS) {
    if (!followUps.includes(fallback)) {
      followUps.push(fallback);
    }
    if (followUps.length >= 3) {
      break;
    }
  }

  return followUps;
}

// 加载知识库数据
export function loadKnowledgeBase(): void {
  try {
    const possiblePaths = [
      '/tmp/expanded-qa-data-5000.json',
      path.join(process.cwd(), 'data', 'expanded-qa-data-5000.json'),
      path.join(__dirname, '../../data', 'expanded-qa-data-5000.json'),
    ];

    let dataPath = '';
    for (const candidate of possiblePaths) {
      if (fs.existsSync(candidate)) {
        dataPath = candidate;
        break;
      }
    }

    if (!dataPath) {
      console.warn('⚠️ 知识库文件不存在，使用空知识库');
      isLoaded = true;
      return;
    }

    const rawData = fs.readFileSync(dataPath, 'utf-8');
    qaData = JSON.parse(rawData) as QAPair[];
    isLoaded = true;
    console.log(`📚 知识库加载成功: ${qaData.length} 条数据 (路径: ${dataPath})`);
  } catch (error) {
    console.error('❌ 知识库加载失败:', error);
    isLoaded = true;
  }
}

function ensureKnowledgeLoaded(): void {
  if (!isLoaded) {
    loadKnowledgeBase();
  }
}

// 搜索知识库
export function searchQA(
  query: string,
  options: {
    category?: string;
    limit?: number;
  } = {}
): KnowledgeSearchResult[] {
  ensureKnowledgeLoaded();

  const normalizedQuery = normalizeText(sanitizeQuery(query));
  if (!normalizedQuery) {
    return [];
  }

  const limit = options.limit || 5;
  const terms = extractSearchTerms(query);
  const signals = collectQuerySignals(query);

  const scoredResults = qaData
    .filter(qa => qa.status === 'published')
    .filter(qa => !options.category || qa.category === options.category)
    .map((qa) => {
      const score = calculateScore(qa, query, normalizedQuery, terms, signals);
      return {
        ...qa,
        score,
        sourceReference: buildSourceReference(qa, score, signals),
      };
    })
    .filter(qa => qa.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.view_count - left.view_count;
    });

  return reorderFocusedResults(scoredResults, signals, query, limit);
}

// 获取相关上下文（用于 RAG）
export function getRelatedContext(question: string, topK: number = 3, category?: string): string {
  const results = searchQA(question, { limit: topK, category });
  return formatContextBlock(results);
}

export function getRelatedSources(question: string, topK: number = 3, category?: string): SourceReference[] {
  return searchQA(question, { limit: topK, category }).map(item => item.sourceReference);
}

export function getFollowUpQuestions(question: string, topK: number = 3, category?: string): string[] {
  const results = searchQA(question, { limit: topK, category });
  return buildFollowUpQuestions(question, results);
}

export function buildKnowledgePack(
  question: string,
  options: {
    category?: string;
    limit?: number;
  } = {}
): {
  context: string;
  sources: SourceReference[];
  followUpQuestions: string[];
  results: KnowledgeSearchResult[];
} {
  const limit = options.limit || 3;
  const results = searchQA(question, {
    category: options.category,
    limit,
  });
  const signals = collectQuerySignals(question);

  const finalResults = needsFocusedSupplement(results, signals)
    ? mergeSearchResults(
      results,
      searchQA(buildFocusedQuery(question, signals) || question, {
        category: options.category,
        limit,
      }),
      limit
    )
    : results;

  return {
    context: formatContextBlock(finalResults),
    sources: finalResults.map(item => item.sourceReference),
    followUpQuestions: buildFollowUpQuestions(question, finalResults),
    results: finalResults,
  };
}

// 获取统计信息
export function getKnowledgeStats(): {
  total: number;
  categories: Record<string, number>;
  isLoaded: boolean;
} {
  ensureKnowledgeLoaded();

  const categories: Record<string, number> = {};
  qaData.forEach(qa => {
    categories[qa.category] = (categories[qa.category] || 0) + 1;
  });

  return {
    total: qaData.length,
    categories,
    isLoaded,
  };
}

// 初始化时加载
loadKnowledgeBase();

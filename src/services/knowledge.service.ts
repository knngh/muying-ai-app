// 知识库服务 - 从 JSON 文件读取问答数据并提供轻量检索能力
import fs from 'fs';
import path from 'path';
import { callTaskModelDetailed } from './ai-gateway.service';
import { getEmbedding, searchKnowledge as searchVectorKnowledge } from './vector.service';
import { getAuthoritySourceConfig, inferAuthorityLocaleDefaults, type AuthoritySourceConfig } from '../config/authority-sources';
import { buildAuthorityDisplayTags } from '../utils/authority-metadata';
import { shouldFilterAuthoritySourceUrl } from '../utils/authority-source-url';
import { inferAuthorityStages } from '../utils/authority-stage';
import { shouldUseAuthorityVectorSupplement } from '../utils/authority-vector-filter';
import { getDatasetKnowledgeDropReason, isOutOfScopeKnowledgeQuery } from '../utils/knowledge-content-guard';
import { detectAudience, detectTopic, sanitizeAuthorityTitle } from './authority-adapters/base.adapter';
import {
  dedupeSearchQueries,
  expandSearchTerms,
  isLikelyChineseQuery,
  normalizeSearchText,
  parseSearchRewriteOutput,
} from '../utils/search-query-expansion';

const AUTHORITY_CACHE_PATHS = [
  '/tmp/authority-knowledge-cache.json',
  path.join(process.cwd(), 'data', 'authority-knowledge-cache.json'),
  path.join(__dirname, '../../data', 'authority-knowledge-cache.json'),
];

const KNOWLEDGE_BASE_PATHS = [
  '/tmp/expanded-qa-data-5000.enriched.json',
  path.join(process.cwd(), 'data', 'expanded-qa-data-5000.enriched.json'),
  path.join(__dirname, '../../data', 'expanded-qa-data-5000.enriched.json'),
  '/tmp/expanded-qa-data-5000.json',
  path.join(process.cwd(), 'data', 'expanded-qa-data-5000.json'),
  path.join(__dirname, '../../data', 'expanded-qa-data-5000.json'),
];

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
  source_id?: string;
  source_org?: string;
  source_class?: 'official' | 'medical_platform' | 'dataset' | 'unknown';
  source_url?: string;
  url?: string;
  audience?: string;
  topic?: string;
  risk_level_default?: KnowledgeRiskLevel;
  region?: string;
  metadata?: Record<string, unknown>;
  references?: AuthorityReference[];
  original_id: string;
}

export type KnowledgeRiskLevel = 'green' | 'yellow' | 'red';

export interface AuthorityReference {
  title?: string;
  url?: string;
  org?: string;
  sourceOrg?: string;
  sourceClass?: 'official' | 'medical_platform' | 'dataset' | 'unknown';
  authoritative?: boolean;
  excerpt?: string;
}

export interface SourceReference {
  title: string;
  source: string;
  relevance: number;
  url?: string;
  excerpt?: string;
  category?: string;
  sourceOrg?: string;
  updatedAt?: string;
  audience?: string;
  topic?: string;
  riskLevelDefault?: KnowledgeRiskLevel;
  region?: string;
  sourceType?: 'authority' | 'dataset' | 'editorial' | 'unknown';
  sourceClass?: 'official' | 'medical_platform' | 'dataset' | 'unknown';
  authoritative?: boolean;
}

export interface KnowledgeSearchResult extends QAPair {
  score: number;
  sourceReference: SourceReference;
}

const AUTHORITATIVE_SOURCE_PATTERNS = [
  /who/i,
  /cdc/i,
  /aap/i,
  /acog/i,
  /mayo/i,
  /msd/i,
  /nih/i,
  /nhs/i,
  /fda/i,
  /国家卫生健康委员会/u,
  /卫健委/u,
  /中国疾控/u,
  /中国疾病预防控制中心/u,
  /国家疾病预防控制局/u,
  /国家卫生健康委妇幼健康中心/u,
  /全国妇幼卫生监测办公室/u,
  /中国出生缺陷监测中心/u,
  /中国营养学会/u,
  /中国政府网/u,
  /ncwchnhc\.org\.cn/i,
  /mchscn\.cn/i,
  /cnsoc\.org/i,
  /chinanutri\.cn/i,
];

const CHINESE_AUTHORITY_SOURCE_PATTERNS = [
  /中国政府网/u,
  /国家卫生健康委员会/u,
  /国家卫健委/u,
  /国家疾病预防控制局/u,
  /国家疾控局/u,
  /中国疾病预防控制中心/u,
  /中国疾控/u,
  /妇幼健康司/u,
  /国家卫生健康委妇幼健康中心/u,
  /全国妇幼卫生监测办公室/u,
  /中国出生缺陷监测中心/u,
  /中国营养学会/u,
  /gov\.cn/i,
  /nhc\.gov\.cn/i,
  /chinacdc\.cn/i,
  /ndcpa\.gov\.cn/i,
  /ncwchnhc\.org\.cn/i,
  /mchscn\.cn/i,
  /cnsoc\.org/i,
  /chinanutri\.cn/i,
  /msdmanuals\.cn/i,
  /\/zh(?:[-_/]|$)/i,
  /chinese/i,
];

const CATEGORY_AUDIENCE_MAP: Partial<Record<QAPair['category'], string>> = {
  'pregnancy-prep': '备孕家庭',
  'pregnancy-early': '孕妇',
  'pregnancy-mid': '孕妇',
  'pregnancy-late': '孕妇',
  'pregnancy-birth': '孕妇',
  'parenting-newborn': '新生儿家长',
  'parenting-0-1': '婴儿家长',
  'parenting-1-3': '幼儿家长',
  'parenting-3-6': '学龄前儿童家长',
  'vaccine-schedule': '婴幼儿家长',
  'vaccine-reaction': '婴幼儿家长',
  'common-symptoms': '母婴家庭',
  'common-disease': '母婴家庭',
};

const CATEGORY_TOPIC_MAP: Partial<Record<QAPair['category'], string>> = {
  'pregnancy-prep': '备孕',
  'pregnancy-early': '孕早期',
  'pregnancy-mid': '孕中期',
  'pregnancy-late': '孕晚期',
  'pregnancy-birth': '分娩与产后',
  'parenting-newborn': '新生儿护理',
  'parenting-0-1': '婴儿护理',
  'parenting-1-3': '幼儿护理',
  'parenting-3-6': '学龄前成长',
  'vaccine-schedule': '疫苗接种',
  'vaccine-reaction': '疫苗反应',
  'common-symptoms': '常见症状',
  'common-disease': '常见疾病',
};

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
const CHINESE_SEGMENT_NOISE_PATTERN = /[的了呢吗吧啊呀和与或及]/u;

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
    id: 'fetal-movement',
    keywords: ['胎动', '胎心', '胎动减少', '胎动少', '胎动异常'],
    categoryBoost: {
      'pregnancy-mid': 22,
      'pregnancy-late': 26,
      'pregnancy-birth': 18,
    },
    mismatchPenalty: {
      'parenting-newborn': 26,
      'parenting-0-1': 26,
      'parenting-1-3': 24,
    },
    textBoost: 18,
    missingTextPenalty: 20,
  },
  {
    id: 'contractions',
    keywords: ['宫缩', '规律宫缩', '宫缩频繁', '假性宫缩', '阵痛'],
    categoryBoost: {
      'pregnancy-late': 26,
      'pregnancy-birth': 24,
      'pregnancy-mid': 14,
    },
    mismatchPenalty: {
      'parenting-newborn': 26,
      'parenting-0-1': 26,
      'parenting-1-3': 24,
    },
    textBoost: 18,
    missingTextPenalty: 20,
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
let authorityQaData: QAPair[] = [];
let allQaData: QAPair[] = [];
let isLoaded = false;
const SEARCH_REWRITE_ENABLED = process.env.AI_SEARCH_REWRITE !== 'false';
const SEARCH_REWRITE_CACHE_TTL_MS = Math.max(60_000, Number(process.env.AI_SEARCH_REWRITE_CACHE_TTL_MS || 30 * 60 * 1000));
const VECTOR_AUTHORITY_RETRIEVAL_ENABLED = process.env.AI_VECTOR_RETRIEVAL !== 'false';
const KNOWLEDGE_RERANK_ENABLED = process.env.AI_KNOWLEDGE_RERANK !== 'false';
const KNOWLEDGE_RERANK_CACHE_TTL_MS = Math.max(60_000, Number(process.env.AI_KNOWLEDGE_RERANK_CACHE_TTL_MS || 10 * 60 * 1000));
const KNOWLEDGE_RERANK_CANDIDATE_LIMIT = Math.max(4, Number(process.env.AI_KNOWLEDGE_RERANK_CANDIDATE_LIMIT || 8));
const KNOWLEDGE_RERANK_API_BASE_URL = process.env.RERANK_API_URL
  || process.env.AI_RERANK_URL
  || process.env.SILICONFLOW_API_URL
  || process.env.EMBEDDING_API_URL
  || 'https://api.siliconflow.cn/v1';
const KNOWLEDGE_RERANK_API_KEY = process.env.RERANK_API_KEY
  || process.env.AI_RERANK_KEY
  || process.env.SILICONFLOW_API_KEY
  || process.env.EMBEDDING_API_KEY
  || '';
const KNOWLEDGE_RERANK_MODEL = process.env.RERANK_MODEL
  || process.env.AI_RERANK_MODEL
  || 'BAAI/bge-reranker-v2-m3';
const KNOWLEDGE_RERANK_TIMEOUT_MS = Math.max(5000, Number(process.env.AI_KNOWLEDGE_RERANK_TIMEOUT_MS || process.env.AI_PROVIDER_TIMEOUT_MS || 12000));
const KNOWLEDGE_CACHE_MAX_SIZE = 500;
const searchRewriteCache = new Map<string, { value: string[]; expiresAt: number }>();
const knowledgeRerankCache = new Map<string, { value: string[]; expiresAt: number }>();

function evictExpiredAndOldest(cache: Map<string, { value: string[]; expiresAt: number }>) {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > KNOWLEDGE_CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
    else break;
  }
}

function buildAuthorityFallbackSourceConfig(qa: QAPair): AuthoritySourceConfig {
  const sourceOrg = qa.source_org || qa.source || '权威机构';
  const localeDefaults = inferAuthorityLocaleDefaults(qa.source_id, qa.region);
  return {
    id: qa.source_id || sourceOrg,
    org: sourceOrg,
    baseUrl: qa.source_url || qa.url || '',
    allowedDomains: [],
    discoveryType: 'index_page',
    entryUrls: [],
    region: (qa.region as AuthoritySourceConfig['region']) || 'GLOBAL',
    language: localeDefaults.sourceLanguage,
    locale: localeDefaults.sourceLocale,
    audience: [qa.audience || '母婴家庭'],
    topics: [qa.topic || qa.category || 'general'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 1,
    parserId: qa.source_id || sourceOrg,
  };
}

export function normalizeAuthorityKnowledgeRecord(qa: QAPair): QAPair {
  const cleanedTitle = sanitizeAuthorityTitle(qa.question || '');
  const sourceConfig = getAuthoritySourceConfig(qa.source_id || '') || buildAuthorityFallbackSourceConfig(qa);
  const inferredAudience = detectAudience({
    sourceUrl: qa.source_url || qa.url,
    title: cleanedTitle || qa.question,
    summary: typeof qa.metadata?.summary === 'string' ? qa.metadata.summary : undefined,
    contentText: qa.answer,
  }, sourceConfig);
  const inferredTopic = detectTopic({
    sourceUrl: qa.source_url || qa.url,
    title: cleanedTitle || qa.question,
    summary: typeof qa.metadata?.summary === 'string' ? qa.metadata.summary : undefined,
    contentText: qa.answer,
  }, sourceConfig);
  const inferredStages = inferAuthorityStages({
    title: cleanedTitle || qa.question,
    summary: typeof qa.metadata?.summary === 'string' ? qa.metadata.summary : undefined,
    contentText: qa.answer,
    audience: inferredAudience,
    topic: inferredTopic,
  });

  return {
    ...qa,
    question: cleanedTitle || qa.question,
    category: inferredTopic || qa.category,
    audience: inferredAudience,
    topic: inferredTopic || qa.topic,
    target_stage: inferredStages.length > 0 ? inferredStages : (qa.target_stage || []),
    tags: buildAuthorityDisplayTags({
      topic: inferredTopic || qa.topic,
      audience: inferredAudience,
      tags: qa.tags,
      sourceOrg: qa.source_org || qa.source,
    }),
  };
}

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
  return normalizeSearchText(text);
}

function getChineseSegments(text: string): string[] {
  const normalized = text.replace(/[^\u4e00-\u9fa5]/g, '');
  const segments = new Set<string>();

  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= normalized.length - size; index += 1) {
      segments.add(normalized.slice(index, index + size));
    }
  }

  return Array.from(segments).filter(segment => (
    !GENERIC_SEGMENTS.has(segment)
    && !CHINESE_SEGMENT_NOISE_PATTERN.test(segment)
  ));
}

function extractSearchTerms(query: string): string[] {
  const normalized = normalizeText(sanitizeQuery(query));
  const latinWords = normalized
    .split(' ')
    .map(word => word.trim())
    .filter(word => word.length >= 2 && !STOP_TERMS.has(word));

  const chineseSegments = getChineseSegments(sanitizeQuery(query));
  const expandedTerms = expandSearchTerms(query);
  const merged = new Set<string>([normalized, ...latinWords, ...chineseSegments, ...expandedTerms]);
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

  for (const result of [...primaryResults, ...supplementResults]) {
    if (!merged.has(result.id)) {
      merged.set(result.id, result);
    }
  }

  return Array.from(merged.values()).slice(0, limit);
}

export function shouldShortCircuitKnowledgeAi(
  query: string,
  results: KnowledgeSearchResult[],
): boolean {
  if (!hasMedicalSymptomIntent(query) || results.length === 0) {
    return false;
  }

  const signals = collectQuerySignals(query);
  if (needsFocusedSupplement(results, signals)) {
    return false;
  }

  const head = results.slice(0, Math.min(3, results.length));
  const topScore = head[0]?.score ?? 0;
  const strongHeadCount = head.filter((item) => item.score >= 70).length;

  if (topScore < 80 || strongHeadCount < Math.min(2, head.length)) {
    return false;
  }

  if (head.some((item) => isPolicyLikeResult(item))) {
    return false;
  }

  return true;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

function hasAvailableSearchRewriteProvider(): boolean {
  return Boolean(
    process.env.AI_MINIMAX_KEY
    || process.env.AI_GATEWAY_KEY
    || process.env.AI_GENERAL_KEY
    || process.env.SILICONFLOW_API_KEY
    || process.env.AI_KIMI_KEY
    || process.env.AI_GLM_KEY
  );
}

function hasAvailableSiliconFlowKnowledgeReranker(): boolean {
  return KNOWLEDGE_RERANK_ENABLED && Boolean(KNOWLEDGE_RERANK_API_KEY);
}

function hasAvailableKnowledgeReranker(): boolean {
  return KNOWLEDGE_RERANK_ENABLED && (
    hasAvailableSiliconFlowKnowledgeReranker()
    || hasAvailableSearchRewriteProvider()
  );
}

function hasAvailableVectorRetrieval(): boolean {
  return VECTOR_AUTHORITY_RETRIEVAL_ENABLED && Boolean(
    process.env.EMBEDDING_API_KEY
    || process.env.OPENAI_API_KEY
    || process.env.AI_GATEWAY_KEY
    || process.env.AI_GENERAL_KEY
    || process.env.AI_MEDICAL_PRIMARY_KEY
  );
}

function buildKnowledgeRerankCacheKey(query: string, results: KnowledgeSearchResult[]): string {
  const normalizedQuery = normalizeText(sanitizeQuery(query));
  return `${normalizedQuery}::${results.map((result) => result.id).join('|')}`;
}

function formatKnowledgeRerankExcerpt(answer: string): string {
  return answer
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function resolveKnowledgeRerankEndpoint(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/g, '');
  if (!normalized) {
    throw new Error('Knowledge rerank API URL is not configured');
  }

  return /\/rerank$/i.test(normalized) ? normalized : `${normalized}/rerank`;
}

export function parseKnowledgeRerankOutput(output: string): string[] {
  const normalized = output.trim();
  if (!normalized) {
    return [];
  }

  const jsonMatch = normalized.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean);
      }

      if (parsed && typeof parsed === 'object') {
        const rankedIds = (parsed as { ranked_ids?: unknown }).ranked_ids;
        if (Array.isArray(rankedIds)) {
          return rankedIds
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean);
        }
      }
    } catch {
      // fall through to line parsing
    }
  }

  return normalized
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean);
}

export function applyKnowledgeRerankOrder(
  results: KnowledgeSearchResult[],
  rankedIds: string[],
): KnowledgeSearchResult[] {
  if (rankedIds.length === 0) {
    return results;
  }

  const byId = new Map(results.map((result) => [result.id, result]));
  const reordered: KnowledgeSearchResult[] = [];
  const seen = new Set<string>();

  for (const id of rankedIds) {
    const matched = byId.get(id);
    if (!matched || seen.has(id)) {
      continue;
    }

    reordered.push(matched);
    seen.add(id);
  }

  for (const result of results) {
    if (!seen.has(result.id)) {
      reordered.push(result);
    }
  }

  return reordered;
}

async function rerankKnowledgeResultsWithSiliconFlow(
  query: string,
  candidateResults: KnowledgeSearchResult[],
): Promise<string[]> {
  if (!hasAvailableSiliconFlowKnowledgeReranker()) {
    return [];
  }

  const response = await fetch(resolveKnowledgeRerankEndpoint(KNOWLEDGE_RERANK_API_BASE_URL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KNOWLEDGE_RERANK_API_KEY}`,
    },
    body: JSON.stringify({
      model: KNOWLEDGE_RERANK_MODEL,
      query,
      documents: candidateResults.map((result) => [
        buildSourceTitle(result),
        result.question,
        formatKnowledgeRerankExcerpt(result.answer),
        result.category,
        `来源机构：${result.sourceReference.sourceOrg || result.source || '知识库'}`,
        `地区：${result.sourceReference.region || result.region || '未知'}`,
        `来源层级：${result.sourceReference.sourceClass || 'unknown'}`,
        `来源类型：${result.sourceReference.sourceType || 'unknown'}`,
      ].join('\n')),
      top_n: candidateResults.length,
      return_documents: false,
    }),
    signal: AbortSignal.timeout(KNOWLEDGE_RERANK_TIMEOUT_MS),
  });

  const bodyText = await response.text();
  let data: {
    results?: Array<{ index?: number; relevance_score?: number }>;
    error?: { message?: string };
    message?: string;
  } | null = null;
  try {
    data = JSON.parse(bodyText) as {
      results?: Array<{ index?: number; relevance_score?: number }>;
      error?: { message?: string };
      message?: string;
    };
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || bodyText.slice(0, 200) || `Knowledge rerank request failed with status ${response.status}`);
  }

  const rankedIds = (data?.results || [])
    .filter((item): item is { index: number; relevance_score?: number } => Number.isInteger(item?.index))
    .sort((left, right) => (right.relevance_score || 0) - (left.relevance_score || 0))
    .map((item) => candidateResults[item.index]?.id)
    .filter((id): id is string => Boolean(id));

  return rankedIds;
}

async function rerankKnowledgeResultsWithLLMFallback(
  query: string,
  candidateResults: KnowledgeSearchResult[],
): Promise<string[]> {
  if (!hasAvailableSearchRewriteProvider()) {
    return [];
  }

  const candidateLines = candidateResults.map((result, index) => JSON.stringify({
    id: result.id,
    rank_hint: index + 1,
    title: buildSourceTitle(result),
    question: result.question,
    category: result.category,
    source: result.sourceReference.sourceOrg || result.source || '知识库',
    region: result.sourceReference.region || result.region || 'unknown',
    source_class: result.sourceReference.sourceClass || 'unknown',
    source_type: result.sourceReference.sourceType || 'unknown',
    authoritative: result.sourceReference.authoritative === true,
    relevance_hint: result.sourceReference.relevance,
    excerpt: formatKnowledgeRerankExcerpt(result.answer),
  }));

  const rerankResult = await callTaskModelDetailed('minimax_render', [
    {
      role: 'system',
      content: [
        '你是母婴知识检索重排助手。',
        '任务是根据用户问题，对候选资料按相关性从高到低排序。',
        '优先考虑：问题意图匹配、孕周/阶段匹配、症状与处理场景匹配、来源权威性。',
        '用户问题为中文时，在相关性接近的候选中优先中国官方/中文权威来源；中文来源不足时再使用英文权威来源补充。',
        '不要扩展候选，不要解释，不要总结。',
        '输出必须是 JSON 对象，格式为 {"ranked_ids":["id1","id2"]}。',
        '只输出候选里已有的 id。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `用户问题：${query}`,
        '候选资料：',
        ...candidateLines,
      ].join('\n'),
    },
  ], {
    temperature: 0.1,
    maxTokens: 240,
  });

  return parseKnowledgeRerankOutput(rerankResult.answer)
    .filter((id, index, values) => candidateResults.some((item) => item.id === id) && values.indexOf(id) === index);
}

async function rerankKnowledgeResults(
  query: string,
  results: KnowledgeSearchResult[],
): Promise<KnowledgeSearchResult[]> {
  if (results.length <= 1 || !hasAvailableKnowledgeReranker()) {
    return results;
  }

  const candidateResults = results.slice(0, KNOWLEDGE_RERANK_CANDIDATE_LIMIT);
  const cacheKey = buildKnowledgeRerankCacheKey(query, candidateResults);
  const cached = knowledgeRerankCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return applyKnowledgeRerankOrder(results, cached.value);
  }

  try {
    let rankedIds = await rerankKnowledgeResultsWithSiliconFlow(query, candidateResults);
    if (rankedIds.length === 0) {
      rankedIds = await rerankKnowledgeResultsWithLLMFallback(query, candidateResults);
    }

    knowledgeRerankCache.set(cacheKey, {
      value: rankedIds,
      expiresAt: Date.now() + KNOWLEDGE_RERANK_CACHE_TTL_MS,
    });
    evictExpiredAndOldest(knowledgeRerankCache);

    return applyKnowledgeRerankOrder(results, rankedIds);
  } catch (error) {
    console.warn('[Knowledge] Rerank fallback:', error);
    return results;
  }
}

function findAuthorityMatch(question: string, source: string): QAPair | undefined {
  const normalizedQuestion = normalizeText(question);
  const normalizedSource = normalizeText(source);
  const exactMatch = authorityQaData.find((item) => (
    normalizeText(item.question) === normalizedQuestion
    && normalizeText(item.source_org || item.source || '') === normalizedSource
  ));

  if (exactMatch) {
    return exactMatch;
  }

  return authorityQaData.find((item) => normalizeText(item.question) === normalizedQuestion);
}

function shouldIncludeAuthoritySearchRecord(qa: QAPair): boolean {
  return shouldUseAuthorityVectorSupplement({
    title: qa.question,
    question: qa.question,
    topic: qa.topic,
    category: qa.category,
    source: qa.source,
    sourceOrg: qa.source_org,
    sourceClass: qa.source_class,
    authoritative: qa.is_verified,
  });
}

function toSyntheticAuthorityQa(result: {
  id: string;
  question: string;
  answer: string;
  category: string;
  source: string;
}): QAPair {
  const now = new Date().toISOString();
  return {
    id: result.id,
    content_type: 'authority',
    question: result.question,
    answer: result.answer,
    category: result.category || 'authority',
    tags: [],
    target_stage: [],
    difficulty: 'authoritative',
    read_time: 5,
    author: {
      name: result.source || 'Authority',
      title: '权威资料',
    },
    is_verified: true,
    status: 'published',
    view_count: 0,
    like_count: 0,
    created_at: now,
    updated_at: now,
    published_at: now,
    source: result.source || 'Authority',
    source_org: result.source || 'Authority',
    source_class: 'official',
    original_id: result.id,
  };
}

function toVectorSupplementResult(
  result: {
    id: string;
    question: string;
    answer: string;
    category: string;
    source: string;
  },
  rank: number,
): KnowledgeSearchResult | null {
  if (!result.id.startsWith('authority-')) {
    return null;
  }

  const matched = findAuthorityMatch(result.question, result.source);
  if (!shouldUseAuthorityVectorSupplement({
    title: result.question,
    question: matched?.question,
    topic: matched?.topic || result.category,
    category: matched?.category || result.category,
    source: matched?.source || result.source,
    sourceOrg: matched?.source_org || result.source,
    sourceClass: matched?.source_class,
  })) {
    return null;
  }

  const score = Math.max(18, 56 - (rank * 4));
  const qa = matched || toSyntheticAuthorityQa(result);

  return {
    ...qa,
    score,
    sourceReference: buildSourceReference(qa, score),
  };
}

async function searchAuthorityVectorSupplements(queries: string[], limit: number): Promise<KnowledgeSearchResult[]> {
  if (!hasAvailableVectorRetrieval()) {
    return [];
  }

  const merged = new Map<string, KnowledgeSearchResult>();
  const uniqueQueries = dedupeSearchQueries('', queries).slice(0, 4);

  for (const query of uniqueQueries) {
    try {
      const embedding = await getEmbedding(query);
      const docs = await searchVectorKnowledge(embedding, Math.max(limit * 3, 6));

      docs.forEach((doc, index) => {
        const candidate = toVectorSupplementResult(doc, index);
        if (!candidate || merged.has(candidate.id)) {
          return;
        }
        merged.set(candidate.id, candidate);
      });
    } catch (error) {
      console.warn('[Knowledge] Vector supplement fallback:', error);
      return Array.from(merged.values()).slice(0, limit);
    }
  }

  return Array.from(merged.values()).slice(0, Math.max(limit * 2, 6));
}

export async function rewriteSearchQueries(question: string): Promise<string[]> {
  const normalized = normalizeText(sanitizeQuery(question));
  if (!SEARCH_REWRITE_ENABLED || !normalized || !isLikelyChineseQuery(question) || !hasAvailableSearchRewriteProvider()) {
    return [];
  }

  const cacheKey = normalized;
  const cached = searchRewriteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const result = await callTaskModelDetailed('minimax_render', [
      {
        role: 'system',
        content: [
          '你是母婴权威知识检索改写助手。',
          '任务是把中文母婴问题改写成更适合检索英文权威资料的短查询。',
          '保留原始意图，不要扩展不存在的症状，不要回答问题。',
          '优先输出 2 到 4 条英文检索短语，面向医学健康搜索。',
          '输出必须是 JSON 字符串数组，不要输出任何额外说明。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `原问题：${question}`,
          '请输出英文检索短语数组，例如：["fever in infants", "baby high fever", "child fever care"]',
        ].join('\n'),
      },
    ], {
      temperature: 0.1,
      maxTokens: 200,
    });

    const rewritten = dedupeSearchQueries('', parseSearchRewriteOutput(result.answer))
      .filter((item) => /[a-z]{3}/i.test(item))
      .slice(0, 4);

    searchRewriteCache.set(cacheKey, {
      value: rewritten,
      expiresAt: Date.now() + SEARCH_REWRITE_CACHE_TTL_MS,
    });
    evictExpiredAndOldest(searchRewriteCache);

    return rewritten;
  } catch (error) {
    console.warn('[Knowledge] Search rewrite fallback:', error);
    searchRewriteCache.set(cacheKey, {
      value: [],
      expiresAt: Date.now() + 60_000,
    });
    evictExpiredAndOldest(searchRewriteCache);
    return [];
  }
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

function questionMatchesFocus(qa: QAPair, focus: 'fever' | 'sleep' | 'feeding' | 'bleeding' | 'edema' | 'fetal-movement' | 'contractions'): boolean {
  const text = qa.question;

  if (focus === 'fever') {
    return /发烧|发热|高烧|退烧/u.test(text);
  }

  if (focus === 'bleeding') {
    return /出血|见红|流血|spotting|bleeding|bloody show/i.test(text);
  }

  if (focus === 'edema') {
    return /水肿|浮肿|脚肿|腿肿|肿胀|edema|swelling/i.test(text);
  }

  if (focus === 'fetal-movement') {
    return /胎动|胎心|fetal movement|fetal heart/i.test(text);
  }

  if (focus === 'contractions') {
    return /宫缩|阵痛|规律宫缩|假性宫缩|contractions?/i.test(text);
  }

  if (focus === 'sleep') {
    return /夜醒|夜里总醒|夜间醒|睡眠|睡觉|哄睡|安抚|闹觉|睡不踏实|翻来覆去/u.test(text);
  }

  return /奶量|喂奶|吃奶|厌奶|母乳|配方奶|断奶|辅食/u.test(text);
}

function focusKeywords(focus: 'fever' | 'sleep' | 'feeding' | 'bleeding' | 'edema' | 'fetal-movement' | 'contractions'): RegExp {
  if (focus === 'fever') {
    return /发烧|发热|高烧|退烧/u;
  }

  if (focus === 'bleeding') {
    return /出血|见红|流血|spotting|bleeding|bloody show/i;
  }

  if (focus === 'edema') {
    return /水肿|浮肿|脚肿|腿肿|肿胀|edema|swelling/i;
  }

  if (focus === 'fetal-movement') {
    return /胎动|胎心|fetal movement|fetal heart/i;
  }

  if (focus === 'contractions') {
    return /宫缩|阵痛|规律宫缩|假性宫缩|contractions?/i;
  }

  if (focus === 'sleep') {
    return /夜醒|夜里总醒|夜间醒|睡眠|睡觉|哄睡|安抚|闹觉|睡不踏实|翻来覆去/u;
  }

  return /奶量|喂奶|吃奶|厌奶|母乳|配方奶|断奶|辅食/u;
}

function answerMatchesFocus(qa: QAPair, focus: 'fever' | 'sleep' | 'feeding' | 'bleeding' | 'edema' | 'fetal-movement' | 'contractions'): boolean {
  const text = `${qa.answer} ${(qa.tags || []).join(' ')} ${qa.category}`;
  return focusKeywords(focus).test(text);
}

function focusMatchesResult(
  qa: Pick<QAPair, 'question' | 'answer' | 'tags' | 'category'>,
  focus: 'fever' | 'sleep' | 'feeding' | 'bleeding' | 'edema' | 'fetal-movement' | 'contractions'
): boolean {
  return questionMatchesFocus(qa as QAPair, focus) || answerMatchesFocus(qa as QAPair, focus);
}

function hasQuestionAnswerFocusConflict(qa: QAPair, focus: 'fever' | 'sleep' | 'feeding' | 'bleeding' | 'edema' | 'fetal-movement' | 'contractions'): boolean {
  return questionMatchesFocus(qa, focus) && !answerMatchesFocus(qa, focus);
}

function isPolicyLikeResult(qa: Pick<QAPair, 'question' | 'answer' | 'tags' | 'category' | 'topic'>): boolean {
  const rawText = `${qa.question} ${qa.answer} ${(qa.tags || []).join(' ')} ${qa.category} ${qa.topic || ''}`;
  return qa.category === 'policy'
    || qa.topic === 'policy'
    || /政策|纲要|指导|全指导|practice update|committee opinion|clinical practice update/i.test(rawText);
}

function hasKnowledgeSearchDomainIntent(query: string): boolean {
  return /怀孕|孕妇|孕期|孕周|产检|胎儿|胎动|胎心|宫缩|破水|预产期|分娩|顺产|剖宫产|产后|月子|哺乳|母乳|备孕|孕前|叶酸|排卵|宝宝|婴儿|新生儿|幼儿|小孩|孩子|月龄|辅食|喂奶|吃奶|奶量|配方奶|疫苗|接种|预防针|育儿|托育|生育|发烧|发热|高烧|咳嗽|腹泻|拉肚子|呕吐|黄疸|湿疹|出血|见红|流血|腹痛|水肿|浮肿|脚肿/u.test(query);
}

function hasMedicalSymptomIntent(query: string): boolean {
  return /出血|见红|流血|腹痛|宫缩|阵痛|水肿|浮肿|脚肿|腿肿|肿胀|发烧|发热|高烧|胎动|胎心|破水|呕吐|腹泻|黄疸|湿疹|咳嗽/u.test(query);
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
  const match = text.match(/((?:3[7-9])|(?:4[0-2]))(?:[.。．](\d))?\s*度/u);
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

function isAuthoritativeSource(qa: QAPair): boolean {
  const sourceText = `${qa.source_org || ''} ${qa.source || ''} ${qa.source_url || ''} ${qa.url || ''}`;
  return AUTHORITATIVE_SOURCE_PATTERNS.some((pattern) => pattern.test(sourceText));
}

function isChineseAuthoritySourceRecord(qa: Pick<QAPair, 'region' | 'source_org' | 'source' | 'source_url' | 'url' | 'source_class'>): boolean {
  const region = (qa.region || '').toUpperCase();
  if (region === 'CN') {
    return true;
  }

  const sourceText = `${qa.source_org || ''} ${qa.source || ''} ${qa.source_url || ''} ${qa.url || ''}`;
  return CHINESE_AUTHORITY_SOURCE_PATTERNS.some((pattern) => pattern.test(sourceText));
}

function isChineseSourceReference(source: SourceReference): boolean {
  const region = (source.region || '').toUpperCase();
  if (region === 'CN') {
    return true;
  }

  const sourceText = `${source.sourceOrg || ''} ${source.source || ''} ${source.url || ''}`;
  return CHINESE_AUTHORITY_SOURCE_PATTERNS.some((pattern) => pattern.test(sourceText));
}

function getChineseSourcePriorityBoost(qa: QAPair, query: string): number {
  if (!isLikelyChineseQuery(query)) {
    return 0;
  }

  let boost = 0;
  const isChineseSource = isChineseAuthoritySourceRecord(qa);
  const hasAuthority = hasAuthorityEvidence(qa);

  if (isChineseSource) {
    boost += 10;
  }

  if (isChineseSource && hasAuthority) {
    boost += 12;
  }

  if (isChineseSource && qa.source_class === 'official') {
    boost += 8;
  }

  return boost;
}

function inferRiskLevelDefault(qa: QAPair): KnowledgeRiskLevel {
  if (qa.risk_level_default) {
    return qa.risk_level_default;
  }

  const text = `${qa.question} ${qa.answer}`;
  if (/大出血|抽搐|惊厥|昏迷|意识异常|呼吸困难|胎动消失|破水/u.test(text)) {
    return 'red';
  }

  if (/发烧|发热|出血|见红|腹痛|腹泻|呕吐|黄疸|湿疹|过敏|宫缩|胎动减少/u.test(text)) {
    return 'yellow';
  }

  return 'green';
}

function isAuthorityReference(reference?: AuthorityReference | null): boolean {
  if (!reference) {
    return false;
  }

  if (reference.authoritative === true || reference.sourceClass === 'official') {
    return true;
  }

  const sourceText = `${reference.org || ''} ${reference.sourceOrg || ''} ${reference.title || ''} ${reference.url || ''}`;
  return AUTHORITATIVE_SOURCE_PATTERNS.some((pattern) => pattern.test(sourceText))
    || /who\.int|cdc\.gov|healthychildren\.org|acog\.org|mayoclinic\.org|msdmanuals\.cn|nhs\.uk|nih\.gov|fda\.gov|nhc\.gov\.cn|chinacdc\.cn|ndcpa\.gov\.cn|gov\.cn/i.test(sourceText);
}

function getPrimaryAuthorityReference(qa: QAPair): AuthorityReference | undefined {
  if (!Array.isArray(qa.references) || qa.references.length === 0) {
    return undefined;
  }

  return qa.references.find((reference) => isAuthorityReference(reference)) || qa.references[0];
}

function hasAuthorityEvidence(qa: QAPair): boolean {
  return isAuthoritativeSource(qa) || isAuthorityReference(getPrimaryAuthorityReference(qa));
}

function buildSourceMetadata(qa: QAPair) {
  const authorityReference = getPrimaryAuthorityReference(qa);
  const sourceText = `${qa.source_id || ''} ${qa.source_org || ''} ${qa.source || ''} ${qa.source_url || ''} ${qa.url || ''}`;
  const authoritative = hasAuthorityEvidence(qa);
  const metadataSourceClass = typeof qa.metadata?.sourceClass === 'string'
    ? qa.metadata.sourceClass
    : undefined;
  const referenceSourceClass = authorityReference?.sourceClass;
  const resolvedReferenceSourceClass: SourceReference['sourceClass'] | undefined =
    referenceSourceClass === 'official' || referenceSourceClass === 'medical_platform' || referenceSourceClass === 'dataset' || referenceSourceClass === 'unknown'
      ? referenceSourceClass
      : (isAuthorityReference(authorityReference) ? 'official' : undefined);
  const sourceClass: SourceReference['sourceClass'] = authoritative
    ? 'official'
    : (
      resolvedReferenceSourceClass
      || qa.source_class
      || (metadataSourceClass === 'official' || metadataSourceClass === 'medical_platform' || metadataSourceClass === 'dataset' || metadataSourceClass === 'unknown'
        ? metadataSourceClass
        : undefined)
      || (/dxy|丁香/u.test(sourceText) || /chunyu|春雨/u.test(sourceText) ? 'medical_platform' : ((qa.source || '').includes('数据集') ? 'dataset' : 'unknown'))
    );
  const sourceType: SourceReference['sourceType'] = authoritative
    ? 'authority'
    : (sourceClass === 'medical_platform' ? 'editorial' : ((qa.source || '').includes('数据集') ? 'dataset' : 'unknown'));

  return {
    sourceOrg: authorityReference?.sourceOrg || authorityReference?.org || qa.source_org || qa.source || '知识库',
    updatedAt: qa.updated_at || qa.published_at || qa.created_at,
    audience: qa.audience || CATEGORY_AUDIENCE_MAP[qa.category] || '母婴家庭',
    topic: qa.topic || CATEGORY_TOPIC_MAP[qa.category] || qa.category,
    riskLevelDefault: inferRiskLevelDefault(qa),
    region: qa.region || 'CN',
    sourceType,
    sourceClass,
    authoritative,
    url: authorityReference?.url || qa.source_url || qa.url,
  } as const;
}

function buildSourceReference(qa: QAPair, score: number, signals?: QuerySignals): SourceReference {
  const metadata = buildSourceMetadata(qa);
  return {
    title: buildSourceTitle(qa, signals),
    source: metadata.sourceOrg || qa.source || '知识库',
    relevance: clampScore(score / 100),
    url: metadata.url,
    excerpt: qa.answer.replace(/\s+/g, ' ').slice(0, 120),
    category: qa.category,
    sourceOrg: metadata.sourceOrg,
    updatedAt: metadata.updatedAt,
    audience: metadata.audience,
    topic: metadata.topic,
    riskLevelDefault: metadata.riskLevelDefault,
    region: metadata.region,
    sourceType: metadata.sourceType,
    sourceClass: metadata.sourceClass,
    authoritative: metadata.authoritative,
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
  const bleedingFocused = signals.matchedGroups.some(group => group.id === 'bleeding');
  const edemaFocused = signals.matchedGroups.some(group => group.id === 'edema');
  const fetalMovementFocused = signals.matchedGroups.some(group => group.id === 'fetal-movement');
  const contractionsFocused = signals.matchedGroups.some(group => group.id === 'contractions');
  const sleepFocused = signals.matchedGroups.some(group => group.id === 'childcare-sleep');
  const feedingFocused = signals.matchedGroups.some(group => group.id === 'childcare-feeding');

  let focus: 'fever' | 'sleep' | 'feeding' | 'bleeding' | 'edema' | 'fetal-movement' | 'contractions' | undefined;
  if (sleepFocused) {
    focus = 'sleep';
  } else if (feedingFocused) {
    focus = 'feeding';
  } else if (contractionsFocused) {
    focus = 'contractions';
  } else if (fetalMovementFocused) {
    focus = 'fetal-movement';
  } else if (bleedingFocused) {
    focus = 'bleeding';
  } else if (edemaFocused) {
    focus = 'edema';
  } else if (feverFocused) {
    focus = 'fever';
  }

  if (!focus) {
    return selectAuthorityPreferredResults(results, limit, query);
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

    if ((focus === 'fever' || focus === 'bleeding' || focus === 'edema' || focus === 'fetal-movement' || focus === 'contractions') && !vaccineIntent && /^vaccine-/.test(result.category)) {
      return false;
    }

    if ((focus === 'sleep' || focus === 'feeding') && !vaccineIntent && /^vaccine-/.test(result.category)) {
      return false;
    }

    if ((focus === 'bleeding' || focus === 'edema' || focus === 'fetal-movement' || focus === 'contractions') && isPolicyLikeResult(result)) {
      return false;
    }

    if (isChildCareQuery(query) && !targetsChildCare(result)) {
      return false;
    }

    return true;
  });

  if (focused.length === 0) {
    return selectAuthorityPreferredResults(results, limit, query);
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
    return selectAuthorityPreferredResults(results, limit, query);
  }

  const merged = new Map<string, KnowledgeSearchResult>();
  for (const result of [...promotableFocused, ...results]) {
    if (!merged.has(result.id)) {
      merged.set(result.id, result);
    }
  }

  return selectAuthorityPreferredResults(Array.from(merged.values()), limit, query);
}

function selectAuthorityPreferredResults(
  results: KnowledgeSearchResult[],
  limit: number,
  query?: string,
): KnowledgeSearchResult[] {
  const head = results.slice(0, limit);
  if (query && hasMedicalSymptomIntent(query)) {
    return selectChineseAuthorityPreferredHead(results, limit, query);
  }

  const authoritativeInHead = head.filter((result) => result.sourceReference.authoritative);
  if (authoritativeInHead.length >= Math.min(2, limit) || results.length <= limit) {
    return head;
  }

  const weakestHeadScore = head[head.length - 1]?.score ?? 0;
  const promotableAuthority = results
    .slice(limit)
    .filter((result) => result.sourceReference.authoritative && result.score >= weakestHeadScore - 8);

  if (promotableAuthority.length === 0) {
    return head;
  }

  const selected = [...head];
  for (const candidate of promotableAuthority) {
    const replacementIndex = selected
      .map((item, index) => ({ item, index }))
      .reverse()
      .find(({ item }) => !item.sourceReference.authoritative && item.score <= candidate.score + 8)?.index;

    if (replacementIndex === undefined) {
      continue;
    }

    selected.splice(replacementIndex, 1, candidate);
  }

  return selected.slice(0, limit);
}

function selectChineseAuthorityPreferredHead(
  results: KnowledgeSearchResult[],
  limit: number,
  query: string,
): KnowledgeSearchResult[] {
  const head = results.slice(0, limit);
  if (!isLikelyChineseQuery(query) || results.length <= limit) {
    return head;
  }

  const selected = [...head];
  const weakestHeadScore = selected[selected.length - 1]?.score ?? 0;
  const promotable = results
    .slice(limit)
    .filter((result) => (
      isChineseSourceReference(result.sourceReference)
      && result.sourceReference.authoritative
      && !isPolicyLikeResult(result)
      && result.score >= weakestHeadScore - 10
    ));

  for (const candidate of promotable) {
    if (selected.some((item) => item.id === candidate.id)) {
      continue;
    }

    const replacementIndex = selected
      .map((item, index) => ({ item, index }))
      .reverse()
      .find(({ item }) => (
        !isChineseSourceReference(item.sourceReference)
        && !item.sourceReference.authoritative
        && item.score <= candidate.score + 10
      ))?.index;

    if (replacementIndex !== undefined) {
      selected.splice(replacementIndex, 1, candidate);
    }
  }

  return selected.slice(0, limit);
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
  const searchableFields = [normalizedQuestion, normalizedAnswer, normalizedTags, normalizedCategory, normalizedSource];

  let score = 0;
  let matchedMeaningfulTermCount = 0;

  if (normalizedQuery && normalizedQuestion.includes(normalizedQuery)) {
    score += 40;
    matchedMeaningfulTermCount += 1;
  }

  if (normalizedQuery && normalizedAnswer.includes(normalizedQuery)) {
    score += 16;
    matchedMeaningfulTermCount += 1;
  }

  for (const term of terms) {
    const questionWeight = Math.min(16, 2 + term.length * 2);
    const answerWeight = Math.min(10, 1 + term.length);
    const tagWeight = Math.min(12, 2 + term.length);
    const categoryWeight = Math.min(10, 1 + term.length);
    const sourceWeight = Math.min(6, Math.max(1, Math.floor(term.length / 2)));
    const isMeaningfulTerm = term.length >= 2 && !STOP_TERMS.has(term) && !GENERIC_SEGMENTS.has(term);
    let matchedTerm = false;

    if (normalizedQuestion.includes(term)) {
      score += questionWeight;
      matchedTerm = true;
    }
    if (normalizedAnswer.includes(term)) {
      score += answerWeight;
      matchedTerm = true;
    }
    if (normalizedTags.includes(term)) {
      score += tagWeight;
      matchedTerm = true;
    }
    if (normalizedCategory.includes(term)) {
      score += categoryWeight;
      matchedTerm = true;
    }
    if (normalizedSource.includes(term)) {
      score += sourceWeight;
      matchedTerm = true;
    }

    if (matchedTerm && isMeaningfulTerm) {
      matchedMeaningfulTermCount += 1;
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

  const hasCategoryIntentMatch = signals.preferredCategories.has(qa.category);
  const hasSignalKeywordMatch = signals.matchedGroups.some(group => group.keywords.some(keyword => rawText.includes(keyword)));
  const hasWholeQueryMatch = Boolean(normalizedQuery && searchableFields.some(field => field.includes(normalizedQuery)));
  const hasDomainIntent = hasKnowledgeSearchDomainIntent(query);
  if (!hasDomainIntent && !hasWholeQueryMatch) {
    return -100;
  }

  if (!hasWholeQueryMatch && matchedMeaningfulTermCount === 0 && !hasCategoryIntentMatch && !hasSignalKeywordMatch) {
    return -100;
  }

  if (qa.is_verified) {
    score += 2;
  }

  if (qa.source_org && isAuthoritativeSource(qa)) {
    score += 18;
  }

  if (hasAuthorityEvidence(qa)) {
    score += 16;
  } else {
    score -= 18;
  }

  score += getChineseSourcePriorityBoost(qa, query);

  if ((qa.tags || []).length > 0) {
    score += 1;
  }

  if (hasCategoryContentConflict(qa)) {
    score -= 24;
  }

  const feverFocused = signals.matchedGroups.some(group => group.id === 'fever');
  const bleedingFocused = signals.matchedGroups.some(group => group.id === 'bleeding');
  const edemaFocused = signals.matchedGroups.some(group => group.id === 'edema');
  const fetalMovementFocused = signals.matchedGroups.some(group => group.id === 'fetal-movement');
  const contractionsFocused = signals.matchedGroups.some(group => group.id === 'contractions');
  const sleepFocused = signals.matchedGroups.some(group => group.id === 'childcare-sleep');
  const feedingFocused = signals.matchedGroups.some(group => group.id === 'childcare-feeding');
  const sleepSoothingIntent = /安抚|哄睡|哄/u.test(query);
  const medicalSymptomIntent = hasMedicalSymptomIntent(query);
  const pregnancyMedicalIntent = /怀孕|孕期|孕妇|胎动|胎心|宫缩|阵痛|见红|破水|羊水|产检|孕周/u.test(query);
  const queryTemperature = extractFeverTemperature(query);
  const queryFeverHandlingIntent = hasFeverHandlingIntent(query);
  const queryExtraSymptoms = new Set(getMatchedExtraSymptoms(query));
  const queryFeverContexts = new Set(getMatchedFeverContexts(query));

  if (medicalSymptomIntent && isPolicyLikeResult(qa)) {
    score -= 36;
  }

  if (pregnancyMedicalIntent) {
    if (qa.category.startsWith('parenting-') || qa.category === 'development') {
      score -= 28;
    }

    if (qa.category.startsWith('pregnancy-') || qa.category === 'pregnancy') {
      score += 10;
    }
  }

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

  if (bleedingFocused) {
    score += questionMatchesFocus(qa, 'bleeding') ? 18 : -26;
    if (hasQuestionAnswerFocusConflict(qa, 'bleeding')) {
      score -= 12;
    }

    if (/孕早期|先兆流产|异位妊娠|宫外孕|ectopic|spotting|bleeding/i.test(qa.question + qa.answer)) {
      score += 12;
    }

    if (isPolicyLikeResult(qa)) {
      score -= 28;
    }
  }

  if (edemaFocused) {
    score += questionMatchesFocus(qa, 'edema') ? 16 : -22;
    if (hasQuestionAnswerFocusConflict(qa, 'edema')) {
      score -= 10;
    }

    if (/高血压|血压|子痫前期|preeclampsia/i.test(qa.question + qa.answer)) {
      score += 8;
    }

    if (isPolicyLikeResult(qa)) {
      score -= 24;
    }
  }

  if (fetalMovementFocused) {
    score += questionMatchesFocus(qa, 'fetal-movement') ? 18 : -26;
    if (hasQuestionAnswerFocusConflict(qa, 'fetal-movement')) {
      score -= 12;
    }

    if (/减少|变少|轻微|异常|消失/u.test(qa.question + qa.answer)) {
      score += 10;
    }

    if (/宝宝|婴儿|新生儿|children|months?/i.test(qa.question + qa.answer) || qa.category === 'development') {
      score -= 24;
    }
  }

  if (contractionsFocused) {
    score += questionMatchesFocus(qa, 'contractions') ? 18 : -26;
    if (hasQuestionAnswerFocusConflict(qa, 'contractions')) {
      score -= 12;
    }

    if (/频繁|规律|疼痛|见红|破水|住院|临产/u.test(qa.question + qa.answer)) {
      score += 10;
    }

    if (/宝宝|婴儿|新生儿|children|months?/i.test(qa.question + qa.answer) || qa.category === 'development') {
      score -= 24;
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
        `来源机构：${qa.sourceReference.sourceOrg || qa.source || '知识库'}`,
        `来源类型：${qa.sourceReference.sourceType || 'unknown'}`,
        `默认风险：${qa.sourceReference.riskLevelDefault || 'yellow'}`,
        `更新时间：${qa.sourceReference.updatedAt || '未知'}`,
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
    let dataPath = '';
    for (const candidate of KNOWLEDGE_BASE_PATHS) {
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
    const parsedData = JSON.parse(rawData) as QAPair[];
    qaData = parsedData.filter((item) => !getDatasetKnowledgeDropReason(item));
    isLoaded = true;
    const filteredCount = parsedData.length - qaData.length;
    console.log(`📚 知识库加载成功: ${qaData.length} 条数据 (过滤 ${filteredCount} 条，路径: ${dataPath})`);
  } catch (error) {
    console.error('❌ 知识库加载失败:', error);
    isLoaded = true;
  }

  try {
    let authorityPath = '';
    for (const candidate of AUTHORITY_CACHE_PATHS) {
      if (fs.existsSync(candidate)) {
        authorityPath = candidate;
        break;
      }
    }

    if (authorityPath) {
      const rawAuthority = fs.readFileSync(authorityPath, 'utf-8');
      authorityQaData = (JSON.parse(rawAuthority) as QAPair[])
        .filter((item) => !shouldFilterAuthoritySourceUrl(item))
        .map((item) => normalizeAuthorityKnowledgeRecord(item))
        .filter((item) => shouldIncludeAuthoritySearchRecord(item));
      console.log(`🏛️ 权威知识快照加载成功: ${authorityQaData.length} 条数据 (路径: ${authorityPath})`);
    } else {
      authorityQaData = [];
    }
  } catch (error) {
    console.error('⚠️ 权威知识快照加载失败:', error);
    authorityQaData = [];
  }

  allQaData = qaData.concat(authorityQaData);
}

function ensureKnowledgeLoaded(): void {
  if (!isLoaded) {
    loadKnowledgeBase();
  }
}

function getSearchableKnowledgePool(): QAPair[] {
  const published = allQaData.filter((qa) => qa.status === 'published');
  // 搜索阶段保留全部已发布内容，再在排序阶段优先权威来源；
  // 否则常见症状类问题会因为权威覆盖不足而直接无结果。
  return published;
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

  if (isOutOfScopeKnowledgeQuery(query)) {
    return [];
  }

  const limit = options.limit || 5;
  const terms = extractSearchTerms(query);
  const signals = collectQuerySignals(query);

  const scoredResults = getSearchableKnowledgePool()
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

function collectKnowledgeCandidates(
  question: string,
  options: {
    category?: string;
    limit?: number;
  } = {},
): KnowledgeSearchResult[] {
  const limit = options.limit || 3;
  const results = searchQA(question, {
    category: options.category,
    limit,
  });
  const signals = collectQuerySignals(question);

  return needsFocusedSupplement(results, signals)
    ? mergeSearchResults(
      results,
      searchQA(buildFocusedQuery(question, signals) || question, {
        category: options.category,
        limit,
      }),
      limit,
    )
    : results;
}

async function collectKnowledgeCandidatesWithRewrite(
  question: string,
  options: {
    category?: string;
    limit?: number;
  } = {},
): Promise<KnowledgeSearchResult[]> {
  const limit = options.limit || 3;
  const candidateLimit = Math.max(limit * 2, KNOWLEDGE_RERANK_CANDIDATE_LIMIT);
  let mergedResults = collectKnowledgeCandidates(question, {
    category: options.category,
    limit: candidateLimit,
  });
  const signals = collectQuerySignals(question);

  if (shouldShortCircuitKnowledgeAi(question, mergedResults)) {
    return reorderFocusedResults(mergedResults, signals, question, candidateLimit);
  }

  const rewrittenQueries = await rewriteSearchQueries(question);
  const dedupedQueries = dedupeSearchQueries(question, rewrittenQueries);
  const vectorSupplements = await searchAuthorityVectorSupplements(dedupedQueries, candidateLimit);

  if (vectorSupplements.length > 0) {
    mergedResults = mergeSearchResults(mergedResults, vectorSupplements, Math.max(candidateLimit * 2, 12));
  }

  for (const rewrittenQuery of rewrittenQueries) {
    mergedResults = mergeSearchResults(
      mergedResults,
      collectKnowledgeCandidates(rewrittenQuery, {
        category: options.category,
        limit: candidateLimit,
      }),
      Math.max(candidateLimit * 2, 12),
    );
  }

  return reorderFocusedResults(
    mergedResults
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return right.view_count - left.view_count;
      }),
    signals,
    question,
    candidateLimit,
  );
}

export async function searchQAWithRewrite(
  query: string,
  options: {
    category?: string;
    limit?: number;
  } = {},
): Promise<KnowledgeSearchResult[]> {
  const limit = options.limit || 5;
  const candidates = await collectKnowledgeCandidatesWithRewrite(query, {
    category: options.category,
    limit,
  });
  if (shouldShortCircuitKnowledgeAi(query, candidates)) {
    return candidates.slice(0, limit);
  }
  const reranked = await rerankKnowledgeResults(query, candidates);
  return selectAuthorityPreferredResults(reranked, limit, query);
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
  const authorityPreferredResults = selectAuthorityPreferredResults(
    collectKnowledgeCandidates(question, {
      category: options.category,
      limit,
    }),
    limit,
    question,
  );

  return {
    context: formatContextBlock(authorityPreferredResults),
    sources: authorityPreferredResults.map(item => item.sourceReference),
    followUpQuestions: buildFollowUpQuestions(question, authorityPreferredResults),
    results: authorityPreferredResults,
  };
}

export async function buildKnowledgePackWithRewrite(
  question: string,
  options: {
    category?: string;
    limit?: number;
  } = {}
): Promise<{
  context: string;
  sources: SourceReference[];
  followUpQuestions: string[];
  results: KnowledgeSearchResult[];
}> {
  const limit = options.limit || 3;
  const candidates = await collectKnowledgeCandidatesWithRewrite(question, options);
  if (shouldShortCircuitKnowledgeAi(question, candidates)) {
    const authorityPreferredResults = candidates.slice(0, limit);
    return {
      context: formatContextBlock(authorityPreferredResults),
      sources: authorityPreferredResults.map((item) => item.sourceReference),
      followUpQuestions: buildFollowUpQuestions(question, authorityPreferredResults),
      results: authorityPreferredResults,
    };
  }
  const reranked = await rerankKnowledgeResults(question, candidates);
  const authorityPreferredResults = selectAuthorityPreferredResults(reranked, limit, question);

  return {
    context: formatContextBlock(authorityPreferredResults),
    sources: authorityPreferredResults.map((item) => item.sourceReference),
    followUpQuestions: buildFollowUpQuestions(question, authorityPreferredResults),
    results: authorityPreferredResults,
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

import { OFFICIAL_AUTHORITY_SOURCE_IDS, getAuthoritySourceConfig } from '../config/authority-sources';
import { detectRiskLevelDefault } from '../services/authority-adapters/base.adapter';
import { shouldFilterAuthoritySourceUrl } from './authority-source-url';
import { inferAuthorityStages, type AuthorityStage } from './authority-stage';
import { getAuthorityKnowledgeDropReason, getDatasetKnowledgeDropReason } from './knowledge-content-guard';
import { expandSearchTerms, normalizeSearchText } from './search-query-expansion';
import type { AuthorityReference, KnowledgeRiskLevel, QAPair } from '../services/knowledge.service';

export const DEFAULT_KNOWLEDGE_ENRICHMENT_TARGET_CATEGORIES = [
  'pregnancy-early',
  'parenting-0-1',
  'common-symptoms',
];

const MATCH_VERSION = 'authority-enrichment-p1-20260505';
const DEFAULT_MAX_REFERENCES = 1;
const DEFAULT_MIN_SCORE = 34;

type SourceClass = NonNullable<QAPair['source_class']>;

interface AuthorityCandidate extends QAPair {
  summary?: string;
  source_updated_at?: string;
  normalizedStrongText: string;
  normalizedText: string;
  resolvedTopic: string;
  resolvedStages: AuthorityStage[];
  resolvedSourceClass: SourceClass;
  authoritative: boolean;
}

export interface KnowledgeEnrichmentOptions {
  targetCategories?: string[];
  maxReferencesPerItem?: number;
  minScore?: number;
  now?: string;
  requireOfficialReference?: boolean;
}

export interface KnowledgeEnrichmentReport {
  total: number;
  kept: number;
  dropped: number;
  authorityInput: number;
  authorityUsable: number;
  targetCategories: string[];
  targetTotal: number;
  enriched: number;
  missingTargetCoverage: number;
  coverageRate: number;
  coverageByCategory: Array<{
    category: string;
    total: number;
    enriched: number;
    coverageRate: number;
  }>;
}

interface KnowledgeEnrichmentResult {
  records: QAPair[];
  report: KnowledgeEnrichmentReport;
}

interface MatchResult {
  candidate: AuthorityCandidate;
  score: number;
  matchType: 'lexical' | 'category_fallback';
  matchedTerms: string[];
  hasUsefulLexicalMatch: boolean;
}

const CATEGORY_PROFILE_MAP: Record<string, {
  topic: string;
  topics: string[];
  stages: AuthorityStage[];
  audience: string;
  terms: string[];
}> = {
  'pregnancy-prep': {
    topic: 'pregnancy',
    topics: ['pregnancy', 'feeding'],
    stages: ['preparation'],
    audience: '备孕家庭',
    terms: ['备孕', '孕前', '叶酸', '排卵', 'preconception', 'folic acid'],
  },
  'pregnancy-early': {
    topic: 'pregnancy',
    topics: ['pregnancy', 'feeding', 'common-symptoms'],
    stages: ['first-trimester'],
    audience: '孕妇',
    terms: ['孕早期', '怀孕初期', '早孕', '孕吐', '见红', '孕酮', 'first trimester', 'early pregnancy'],
  },
  'pregnancy-mid': {
    topic: 'pregnancy',
    topics: ['pregnancy', 'feeding', 'common-symptoms'],
    stages: ['second-trimester'],
    audience: '孕妇',
    terms: ['孕中期', '胎动', '唐筛', '糖耐', '四维', 'second trimester'],
  },
  'pregnancy-late': {
    topic: 'pregnancy',
    topics: ['pregnancy', 'common-symptoms'],
    stages: ['third-trimester'],
    audience: '孕妇',
    terms: ['孕晚期', '宫缩', '破水', '见红', '待产', 'third trimester'],
  },
  'pregnancy-birth': {
    topic: 'postpartum',
    topics: ['pregnancy', 'postpartum', 'common-symptoms'],
    stages: ['third-trimester', 'postpartum'],
    audience: '孕妇',
    terms: ['分娩', '顺产', '剖宫产', '产后', '临产', 'labor', 'postpartum'],
  },
  'parenting-newborn': {
    topic: 'newborn',
    topics: ['newborn', 'feeding', 'common-symptoms', 'vaccination', 'development'],
    stages: ['newborn', '0-6-months'],
    audience: '新生儿家长',
    terms: ['新生儿', '黄疸', '脐带', '出生', 'newborn'],
  },
  'parenting-0-1': {
    topic: 'newborn',
    topics: ['newborn', 'feeding', 'common-symptoms', 'vaccination', 'development'],
    stages: ['0-6-months', '6-12-months'],
    audience: '婴幼儿家长',
    terms: ['宝宝', '婴儿', '母乳', '辅食', '夜醒', '睡眠', '喂奶', '吃奶', 'baby', 'infant'],
  },
  'parenting-1-3': {
    topic: 'development',
    topics: ['development', 'feeding', 'common-symptoms', 'vaccination'],
    stages: ['1-3-years'],
    audience: '幼儿家长',
    terms: ['幼儿', '一岁', '两岁', '断奶', '走路', '说话', 'toddler'],
  },
  'parenting-3-6': {
    topic: 'development',
    topics: ['development', 'common-symptoms'],
    stages: ['3-years-plus'],
    audience: '学龄前儿童家长',
    terms: ['学龄前', '入园', '社交', '语言', 'preschool'],
  },
  'common-symptoms': {
    topic: 'common-symptoms',
    topics: ['common-symptoms', 'newborn', 'pregnancy'],
    stages: ['0-6-months', '6-12-months', '1-3-years', 'first-trimester', 'second-trimester', 'third-trimester'],
    audience: '母婴家庭',
    terms: ['发烧', '发热', '咳嗽', '腹泻', '呕吐', '便秘', '湿疹', 'fever', 'diarrhea', 'vomiting'],
  },
  'common-disease': {
    topic: 'common-symptoms',
    topics: ['common-symptoms', 'newborn'],
    stages: ['0-6-months', '6-12-months', '1-3-years'],
    audience: '母婴家庭',
    terms: ['感冒', '感染', '过敏', '肺炎', 'fever', 'infection'],
  },
  'common-development': {
    topic: 'development',
    topics: ['development', 'newborn'],
    stages: ['0-6-months', '6-12-months', '1-3-years', '3-years-plus'],
    audience: '母婴家庭',
    terms: ['发育', '语言', '走路', '里程碑', 'development', 'milestone'],
  },
  'common-safety': {
    topic: 'development',
    topics: ['development', 'common-symptoms'],
    stages: ['0-6-months', '6-12-months', '1-3-years', '3-years-plus'],
    audience: '母婴家庭',
    terms: ['安全', '护理', '意外', '窒息', 'safe', 'safety'],
  },
  'nutrition-pregnancy': {
    topic: 'feeding',
    topics: ['feeding', 'pregnancy'],
    stages: ['first-trimester', 'second-trimester', 'third-trimester'],
    audience: '孕妇',
    terms: ['孕期营养', '饮食', '补钙', '叶酸', 'nutrition', 'diet'],
  },
  'nutrition-baby': {
    topic: 'feeding',
    topics: ['feeding', 'newborn'],
    stages: ['0-6-months', '6-12-months'],
    audience: '婴幼儿家长',
    terms: ['母乳', '配方奶', '辅食', '奶量', '喂养', 'breastfeeding', 'formula', 'feeding'],
  },
  'nutrition-child': {
    topic: 'feeding',
    topics: ['feeding', 'development'],
    stages: ['1-3-years', '3-years-plus'],
    audience: '幼儿家长',
    terms: ['挑食', '饮食', '营养', '辅食', 'feeding', 'nutrition'],
  },
  'vaccine-schedule': {
    topic: 'vaccination',
    topics: ['vaccination'],
    stages: ['newborn', '0-6-months', '6-12-months', '1-3-years'],
    audience: '婴幼儿家长',
    terms: ['疫苗', '接种', '免疫程序', 'vaccination', 'immunization'],
  },
  'vaccine-reaction': {
    topic: 'vaccination',
    topics: ['vaccination', 'common-symptoms'],
    stages: ['newborn', '0-6-months', '6-12-months', '1-3-years'],
    audience: '婴幼儿家长',
    terms: ['疫苗反应', '接种后', '发热', 'vaccination', 'vaccine'],
  },
  'vaccine-first': {
    topic: 'vaccination',
    topics: ['vaccination'],
    stages: ['newborn', '0-6-months'],
    audience: '新生儿家长',
    terms: ['首次疫苗', '卡介苗', '乙肝疫苗', 'vaccination'],
  },
  'vaccine-second': {
    topic: 'vaccination',
    topics: ['vaccination'],
    stages: ['0-6-months', '6-12-months'],
    audience: '婴幼儿家长',
    terms: ['第二针', '疫苗', '接种', 'vaccination'],
  },
};

const TOPIC_KEYWORD_HINTS: Array<{ topic: string; terms: string[] }> = [
  { topic: 'vaccination', terms: ['疫苗', '接种', '预防针', '卡介', '百白破', '乙肝疫苗', 'vaccine', 'vaccination', 'immunization'] },
  { topic: 'feeding', terms: ['母乳', '辅食', '喂奶', '吃奶', '奶量', '配方奶', 'breastfeeding', 'feeding', 'formula'] },
  { topic: 'development', terms: ['发育', '里程碑', '睡眠', '夜醒', '走路', '说话', '语言', 'development', 'milestone', 'sleep'] },
  { topic: 'common-symptoms', terms: ['感冒', '发烧', '发热', '咳嗽', '腹泻', '呕吐', '便秘', '湿疹', '黄疸', '出血', '腹痛', '用药', '打针', 'fever', 'diarrhea', 'vomit', 'rash', 'cold', 'medication'] },
  { topic: 'pregnancy', terms: ['孕', '怀孕', '产检', '胎儿', '胎动', '宫缩', '破水', 'pregnancy', 'prenatal'] },
  { topic: 'newborn', terms: ['新生儿', '婴儿', '宝宝', '月龄', 'newborn', 'infant', 'baby'] },
];

const DOMAIN_TERM_EXPANSIONS: Array<{ terms: string[]; expansions: string[] }> = [
  { terms: ['感冒', '咳嗽'], expansions: ['cold', 'cough', 'flu'] },
  { terms: ['打针', '针剂', '吊瓶', '输液'], expansions: ['injection', 'medication', 'medicine'] },
  { terms: ['吃药', '用药', '药物', '感冒药'], expansions: ['medication', 'medicine', 'drug safety'] },
  { terms: ['流产'], expansions: ['miscarriage', 'pregnancy loss'] },
  { terms: ['出血', '见红', '流血'], expansions: ['bleeding', 'spotting'] },
  { terms: ['黄疸'], expansions: ['jaundice'] },
  { terms: ['便秘'], expansions: ['constipation'] },
  { terms: ['湿疹', '红疹'], expansions: ['eczema', 'rash'] },
  { terms: ['夜醒', '睡不好'], expansions: ['sleep', 'night waking'] },
  { terms: ['乙肝疫苗'], expansions: ['hepatitis b vaccine'] },
];

const MEDICAL_YELLOW_PATTERN = /发烧|发热|咳嗽|腹泻|拉肚子|呕吐|便秘|湿疹|黄疸|腹痛|出血|见红|流血|宫缩|水肿|胎动|疫苗|接种|用药|感冒|感染|过敏|疼|痛|fever|diarrhea|vomit|bleeding|vaccine|medication/i;
const MEDICAL_RED_PATTERN = /呼吸困难|抽搐|惊厥|意识异常|昏迷|大出血|破水|胎动消失|高热不退|脱水|shortness of breath|seizure|unresponsive/i;
const GENERIC_TERMS = new Set([
  '母婴',
  '宝宝',
  '婴儿',
  '孩子',
  '怀孕',
  '孕妇',
  '需要',
  '注意',
  '怎么办',
  '怎么',
  '什么',
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'what',
  'when',
  'during',
  'your',
  'you',
  'baby',
  'infant',
  'child',
  'children',
  'of',
  'at',
  'to',
  'in',
  'common',
  'symptoms',
  'general',
  'months',
  'month',
  'first',
  'second',
  'third',
  'trimester',
  'early',
  'show',
]);

const BROAD_MATCH_TERMS = new Set([
  '怀孕',
  '孕期',
  '孕妇',
  '宝宝',
  '婴儿',
  '小孩',
  '孩子',
  '儿童',
  'pregnancy',
  'pregnant',
  'prenatal',
  'baby',
  'infant',
  'child',
  'children',
  'early pregnancy',
  'first trimester',
  'second trimester',
  'third trimester',
]);

const FULL_BODY_ALLOWED_SPECIFIC_TERMS = new Set([
  'bleeding',
  'spotting',
  'fever',
  'cough',
  'cold',
  'diarrhea',
  'vomiting',
  'constipation',
  'jaundice',
  'eczema',
  'rash',
  'hepatitis b vaccine',
]);

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function compactText(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function buildText(record: Partial<QAPair> & { summary?: string; title?: string; source_updated_at?: string }): string {
  return [
    record.title,
    record.question,
    record.summary,
    record.answer?.slice(0, 2400),
    record.category,
    record.topic,
    record.audience,
    record.source,
    record.source_org,
    record.source_id,
    record.source_url,
    record.url,
    ...(record.tags || []),
  ].filter(Boolean).join(' ');
}

function buildStrongAuthorityText(record: Partial<QAPair> & { summary?: string; title?: string }): string {
  return [
    record.title,
    record.question,
    record.summary,
    record.category,
    record.topic,
    record.audience,
    record.source,
    record.source_org,
    record.source_id,
    record.source_url,
    record.url,
    ...(record.tags || []),
  ].filter(Boolean).join(' ');
}

function buildIntentText(record: Partial<QAPair>): string {
  return [
    record.question,
    record.category,
    record.topic,
    ...(record.tags || []),
  ].filter(Boolean).join(' ');
}

function normalizeTopic(topic?: string): string {
  const value = compactText(topic).toLowerCase();
  if (!value || value === 'authority') {
    return 'general';
  }
  return value;
}

function getCategoryProfile(category?: string) {
  return CATEGORY_PROFILE_MAP[category || ''];
}

function inferQaTopic(item: QAPair): string {
  const profile = getCategoryProfile(item.category);
  const text = buildIntentText(item).toLowerCase();

  for (const hint of TOPIC_KEYWORD_HINTS) {
    if (hint.terms.some((term) => text.includes(term.toLowerCase()))) {
      if (profile?.topics.includes(hint.topic) || !profile) {
        return hint.topic;
      }
    }
  }

  return item.topic || profile?.topic || item.category || 'general';
}

function inferPregnancyStageFromText(text: string): AuthorityStage | null {
  const weekMatch = text.match(/(?:怀孕|孕)(?:第)?\s*(\d{1,2})\s*周/u);
  if (weekMatch?.[1]) {
    const week = Number(weekMatch[1]);
    if (week > 0 && week <= 13) return 'first-trimester';
    if (week <= 27) return 'second-trimester';
    if (week <= 42) return 'third-trimester';
  }

  if (/孕早期|怀孕初期|刚怀孕|早孕|孕酮|hcg|nt/u.test(text)) return 'first-trimester';
  if (/孕中期|四维|唐筛|糖耐|胎动/u.test(text)) return 'second-trimester';
  if (/孕晚期|足月|宫缩|破水|待产|入盆|临产/u.test(text)) return 'third-trimester';
  return null;
}

function inferQaStages(item: QAPair, topic: string): AuthorityStage[] {
  if (Array.isArray(item.target_stage) && item.target_stage.length > 0) {
    return item.target_stage.filter((stage): stage is AuthorityStage => typeof stage === 'string') as AuthorityStage[];
  }

  const profile = getCategoryProfile(item.category);
  const intentText = buildIntentText(item);
  const pregnancyStage = inferPregnancyStageFromText(intentText);
  if (pregnancyStage) {
    return uniq([pregnancyStage, ...(profile?.stages || [])]);
  }

  if (profile?.stages.length) {
    return profile.stages;
  }

  const inferred = inferAuthorityStages({
    title: item.question,
    summary: (item.tags || []).join(' '),
    audience: item.audience,
    topic,
  });

  return inferred;
}

function inferQaRiskLevel(item: QAPair): KnowledgeRiskLevel {
  if (item.risk_level_default) {
    return item.risk_level_default;
  }

  const text = buildIntentText(item);
  if (MEDICAL_RED_PATTERN.test(text)) {
    return 'red';
  }
  if (MEDICAL_YELLOW_PATTERN.test(text)) {
    return 'yellow';
  }
  return detectRiskLevelDefault(text);
}

function isOfficialAuthority(record: QAPair): boolean {
  return record.source_class === 'official'
    || OFFICIAL_AUTHORITY_SOURCE_IDS.has(record.source_id || '')
    || /who\.int|cdc\.gov|healthychildren\.org|acog\.org|mayoclinic\.org|msdmanuals\.cn|nhs\.uk|nhc\.gov\.cn|chinacdc\.cn|ndcpa\.gov\.cn|gov\.cn|ncwchnhc\.org\.cn|mchscn\.cn|cnsoc\.org|chinanutri\.cn|cma\.org\.cn/i.test(`${record.source_org || ''} ${record.source || ''} ${record.source_url || ''} ${record.url || ''}`);
}

function resolveAuthorityTopic(record: QAPair & { summary?: string }): string {
  if (record.topic) {
    return normalizeTopic(record.topic);
  }

  const source = getAuthoritySourceConfig(record.source_id || '');
  if (source?.topics.length === 1) {
    return source.topics[0] || 'general';
  }

  const text = buildText(record).toLowerCase();
  for (const hint of TOPIC_KEYWORD_HINTS) {
    if (hint.terms.some((term) => text.includes(term.toLowerCase()))) {
      return hint.topic;
    }
  }

  return normalizeTopic(record.category);
}

function resolveAuthorityStages(record: QAPair & { summary?: string }): AuthorityStage[] {
  if (Array.isArray(record.target_stage) && record.target_stage.length > 0) {
    return record.target_stage.filter((stage): stage is AuthorityStage => typeof stage === 'string') as AuthorityStage[];
  }

  return inferAuthorityStages({
    title: record.question,
    summary: record.summary,
    contentText: record.answer,
    audience: record.audience,
    topic: resolveAuthorityTopic(record),
  });
}

function resolveAuthoritySourceClass(record: QAPair): SourceClass {
  if (isOfficialAuthority(record)) {
    return 'official';
  }
  if (record.source_class === 'medical_platform') {
    return 'medical_platform';
  }
  if (record.source_class === 'dataset') {
    return 'dataset';
  }
  return 'unknown';
}

function toAuthorityCandidate(record: QAPair & { summary?: string }): AuthorityCandidate | null {
  if (shouldFilterAuthoritySourceUrl(record) || getAuthorityKnowledgeDropReason(record)) {
    return null;
  }

  const authoritative = isOfficialAuthority(record);
  const resolvedTopic = resolveAuthorityTopic(record);
  const resolvedStages = resolveAuthorityStages(record);
  const resolvedSourceClass = resolveAuthoritySourceClass(record);
  const normalizedStrongText = normalizeSearchText([
    buildStrongAuthorityText(record),
    resolvedTopic,
    ...resolvedStages,
  ].join(' '));
  const normalizedText = normalizeSearchText([
    buildText(record),
    resolvedTopic,
    ...resolvedStages,
  ].join(' '));

  if (!record.question || !record.answer || !normalizedText) {
    return null;
  }

  return {
    ...record,
    normalizedStrongText,
    normalizedText,
    resolvedTopic,
    resolvedStages,
    resolvedSourceClass,
    authoritative,
  };
}

function collectDomainExpansions(text: string): string[] {
  const terms = new Set<string>();
  for (const entry of DOMAIN_TERM_EXPANSIONS) {
    if (!entry.terms.some((term) => text.includes(term))) {
      continue;
    }
    for (const term of [...entry.terms, ...entry.expansions]) {
      terms.add(term);
    }
  }

  return Array.from(terms);
}

function collectSearchTerms(item: QAPair): string[] {
  const baseText = [
    item.question,
    ...(item.tags || []),
  ].join(' ');

  const expanded = expandSearchTerms(baseText);
  const domainTerms = collectDomainExpansions(baseText);
  const directTerms = baseText.split(/\s+/);

  return uniq([...expanded, ...domainTerms, ...directTerms])
    .map((term) => normalizeSearchText(term))
    .filter((term) => {
      if (term.length < 2 || GENERIC_TERMS.has(term) || /^\d+$/.test(term)) {
        return false;
      }
      if (!/[\u4e00-\u9fff]/u.test(term) && !term.includes(' ') && term.length < 4) {
        return false;
      }
      return true;
    })
    .slice(0, 48);
}

function isPregnancyTopic(topic: string): boolean {
  return topic === 'pregnancy' || topic === 'postpartum';
}

function isChildTopic(topic: string): boolean {
  return ['newborn', 'feeding', 'vaccination', 'development'].includes(topic);
}

function getTopicScore(qaTopic: string, profileTopics: string[], candidateTopic: string): number {
  if (candidateTopic === qaTopic) {
    return 26;
  }

  if (profileTopics.includes(candidateTopic)) {
    return 18;
  }

  if (candidateTopic === 'general') {
    return -6;
  }

  if (qaTopic === 'common-symptoms' && ['newborn', 'pregnancy'].includes(candidateTopic)) {
    return 8;
  }

  if (isPregnancyTopic(qaTopic) && isChildTopic(candidateTopic)) {
    return -32;
  }

  if (isChildTopic(qaTopic) && isPregnancyTopic(candidateTopic)) {
    return -28;
  }

  return -14;
}

function getStageScore(qaStages: AuthorityStage[], candidateStages: AuthorityStage[]): number {
  if (qaStages.length === 0 || candidateStages.length === 0) {
    return 0;
  }

  const overlap = qaStages.filter((stage) => candidateStages.includes(stage));
  if (overlap.length > 0) {
    return Math.min(22, overlap.length * 8 + 10);
  }

  const pregnancyStages: AuthorityStage[] = ['first-trimester', 'second-trimester', 'third-trimester'];
  const qaPregnancy = qaStages.some((stage) => pregnancyStages.includes(stage));
  const candidatePregnancy = candidateStages.some((stage) => pregnancyStages.includes(stage));
  if (qaPregnancy !== candidatePregnancy) {
    return -16;
  }

  return -4;
}

function findMatchedTerms(terms: string[], normalizedCandidateText: string): string[] {
  return uniq(terms.filter((term) => normalizedCandidateText.includes(term))).slice(0, 12);
}

function scoreMatchedTerms(terms: string[], weight = 1): number {
  return terms.reduce((sum, term) => {
    const rawScore = /[\u4e00-\u9fff]/u.test(term)
      ? Math.min(10, Math.max(4, term.length))
      : Math.min(8, Math.max(3, term.length / 2));
    return sum + (rawScore * weight);
  }, 0);
}

function isBroadMatchTerm(term: string): boolean {
  return BROAD_MATCH_TERMS.has(term);
}

function getTermScore(
  terms: string[],
  normalizedStrongText: string,
  normalizedCandidateText: string,
): {
  score: number;
  matchedTerms: string[];
  strongMatchedTerms: string[];
  specificStrongMatchedTerms: string[];
  specificFullMatchedTerms: string[];
} {
  const strongMatchedTerms = findMatchedTerms(terms, normalizedStrongText);
  const fullMatchedTerms = findMatchedTerms(terms, normalizedCandidateText);
  const fullOnlyTerms = fullMatchedTerms.filter((term) => !strongMatchedTerms.includes(term));
  const uniqueMatchedTerms = uniq([...strongMatchedTerms, ...fullOnlyTerms]).slice(0, 12);
  const specificStrongMatchedTerms = strongMatchedTerms.filter((term) => !isBroadMatchTerm(term));
  const specificFullMatchedTerms = fullMatchedTerms.filter((term) => !isBroadMatchTerm(term));
  const score = uniqueMatchedTerms.reduce((sum, term) => {
    if (strongMatchedTerms.includes(term)) {
      return sum + scoreMatchedTerms([term], 1.4);
    }
    return sum + scoreMatchedTerms([term], 0.45);
  }, 0);

  return {
    score: Math.min(34, Math.round(score)),
    matchedTerms: uniqueMatchedTerms,
    strongMatchedTerms,
    specificStrongMatchedTerms,
    specificFullMatchedTerms,
  };
}

function isChineseSource(candidate: AuthorityCandidate): boolean {
  const text = `${candidate.region || ''} ${candidate.source_id || ''} ${candidate.source_org || ''} ${candidate.source_url || ''} ${candidate.url || ''}`;
  return /CN|zh|nhc|chinacdc|govcn|ndcpa|msd-manuals-cn|ncwch|mchscn|cnsoc|chinanutri|cma-kepu|中国|国家|疾控|卫健委|msdmanuals\.cn/i.test(text);
}

function getIntentSpecificScore(item: QAPair, candidate: AuthorityCandidate): number {
  const intentText = buildIntentText(item).toLowerCase();
  const strongText = candidate.normalizedStrongText;
  let score = 0;

  if (/(感冒|吃药|用药|药物|感冒药|打针|针剂|输液|吊瓶)/u.test(intentText)
    && /medicine|medication|drug|medicines|taking|using|injection|medicine and pregnancy|medicine-and-pregnancy/u.test(strongText)) {
    score += 28;
  }

  if (/(出血|见红|流血|流产|先兆流产)/u.test(intentText)
    && /bleeding|spotting|pregnancy loss|miscarriage|optimizing care for pregnancy loss/u.test(strongText)) {
    score += 28;
  }

  if (/(乙肝|百白破|麻腮风|卡介|疫苗|接种|预防针)/u.test(intentText)
    && /vaccine|vaccination|immunization|疫苗|接种|免疫/u.test(strongText)) {
    score += 18;
  }

  if (/vitamin k shot|newborn needs a vitamin k/u.test(strongText)
    && !/(维生素\s*k|vitamin\s*k|新生儿|出生|脐带)/iu.test(intentText)) {
    score -= 32;
  }

  return score;
}

function scoreCandidate(
  item: QAPair,
  candidate: AuthorityCandidate,
  qaTopic: string,
  qaStages: AuthorityStage[],
  searchTerms: string[],
): MatchResult {
  const profile = getCategoryProfile(item.category);
  const {
    score: termScore,
    matchedTerms,
    specificStrongMatchedTerms,
    specificFullMatchedTerms,
  } = getTermScore(searchTerms, candidate.normalizedStrongText, candidate.normalizedText);
  const topicScore = getTopicScore(qaTopic, profile?.topics || [qaTopic], candidate.resolvedTopic);
  const stageScore = getStageScore(qaStages, candidate.resolvedStages);
  const sourceScore = candidate.authoritative ? 18 : 4;
  const chinaSourceScore = isChineseSource(candidate) ? 8 : 0;
  const intentSpecificScore = getIntentSpecificScore(item, candidate);
  const policyPenalty = candidate.resolvedTopic === 'policy' && qaTopic !== 'policy' ? -18 : 0;
  const answerLengthScore = candidate.answer.length >= 600 ? 4 : 0;
  const fullBodySpecificAllowed = specificFullMatchedTerms.some((term) => FULL_BODY_ALLOWED_SPECIFIC_TERMS.has(term));
  const hasUsefulLexicalMatch = specificStrongMatchedTerms.length > 0
    || (
      fullBodySpecificAllowed
      && topicScore > 0
      && stageScore >= 0
    );
  const weakFullBodyPenalty = specificStrongMatchedTerms.length === 0 ? -18 : 0;
  const score = sourceScore + chinaSourceScore + intentSpecificScore + topicScore + stageScore + termScore + policyPenalty + answerLengthScore + weakFullBodyPenalty;

  return {
    candidate,
    score,
    matchType: matchedTerms.length > 0 ? 'lexical' : 'category_fallback',
    matchedTerms,
    hasUsefulLexicalMatch,
  };
}

function findAuthorityMatches(
  item: QAPair,
  candidates: AuthorityCandidate[],
  options: Required<Pick<KnowledgeEnrichmentOptions, 'maxReferencesPerItem' | 'minScore' | 'requireOfficialReference'>>,
): MatchResult[] {
  const qaTopic = inferQaTopic(item);
  const qaStages = inferQaStages(item, qaTopic);
  const searchTerms = collectSearchTerms(item);

  return candidates
    .filter((candidate) => !options.requireOfficialReference || candidate.authoritative)
    .map((candidate) => scoreCandidate(item, candidate, qaTopic, qaStages, searchTerms))
    .filter((match) => (
      match.hasUsefulLexicalMatch
      && match.score >= options.minScore
    ))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.candidate.authoritative !== right.candidate.authoritative) return left.candidate.authoritative ? -1 : 1;
      if (isChineseSource(left.candidate) !== isChineseSource(right.candidate)) return isChineseSource(left.candidate) ? -1 : 1;
      return left.candidate.id.localeCompare(right.candidate.id);
    })
    .slice(0, options.maxReferencesPerItem);
}

function toAuthorityReference(match: MatchResult): AuthorityReference {
  const candidate = match.candidate;
  return {
    title: candidate.question,
    url: candidate.source_url || candidate.url,
    org: candidate.source_org || candidate.source,
    sourceOrg: candidate.source_org || candidate.source,
    sourceClass: candidate.resolvedSourceClass,
    authoritative: candidate.authoritative,
    excerpt: compactText(candidate.summary || candidate.answer).slice(0, 220),
  };
}

function mergeReferences(existing: AuthorityReference[] | undefined, additions: AuthorityReference[]): AuthorityReference[] {
  const refs = [...(existing || []), ...additions];
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.url || ''}::${ref.title || ''}::${ref.sourceOrg || ref.org || ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function enrichItem(item: QAPair, matches: MatchResult[], now: string): QAPair {
  const topic = item.topic || inferQaTopic(item);
  const targetStage = Array.isArray(item.target_stage) && item.target_stage.length > 0
    ? item.target_stage
    : inferQaStages(item, topic);
  const references = mergeReferences(item.references, matches.map(toAuthorityReference));
  const primaryMatch = matches[0];

  const enrichedItem: QAPair = {
    ...item,
    source_class: item.source_class || 'dataset',
    source_org: item.source_org || item.source || 'cMedQA2数据集',
    topic,
    target_stage: targetStage,
    risk_level_default: inferQaRiskLevel(item),
    metadata: {
      ...(item.metadata || {}),
      authorityCoverage: {
        status: matches.length > 0 ? 'matched' : 'missing',
        matchVersion: MATCH_VERSION,
        matchedAt: now,
        matchType: primaryMatch?.matchType,
        score: primaryMatch?.score,
        sourceIds: matches.map((match) => match.candidate.source_id).filter(Boolean),
        authorityIds: matches.map((match) => match.candidate.id),
        matchedTerms: uniq(matches.flatMap((match) => match.matchedTerms)).slice(0, 12),
      },
    },
  };

  if (references.length > 0) {
    enrichedItem.references = references;
  }

  return enrichedItem;
}

function buildCoverageByCategory(records: QAPair[], targetCategorySet: Set<string>): KnowledgeEnrichmentReport['coverageByCategory'] {
  const categoryMap = new Map<string, { total: number; enriched: number }>();
  for (const record of records) {
    if (!targetCategorySet.has(record.category)) {
      continue;
    }
    const entry = categoryMap.get(record.category) || { total: 0, enriched: 0 };
    entry.total += 1;
    if (Array.isArray(record.references) && record.references.some((ref) => ref.authoritative === true || ref.sourceClass === 'official')) {
      entry.enriched += 1;
    }
    categoryMap.set(record.category, entry);
  }

  return Array.from(categoryMap.entries())
    .map(([category, value]) => ({
      category,
      total: value.total,
      enriched: value.enriched,
      coverageRate: Number(((value.enriched / Math.max(value.total, 1)) * 100).toFixed(2)),
    }))
    .sort((left, right) => right.total - left.total);
}

export function enrichKnowledgeBaseRecords(
  qaRecords: QAPair[],
  authorityRecords: QAPair[],
  options: KnowledgeEnrichmentOptions = {},
): KnowledgeEnrichmentResult {
  const targetCategories = options.targetCategories?.length
    ? options.targetCategories
    : DEFAULT_KNOWLEDGE_ENRICHMENT_TARGET_CATEGORIES;
  const targetCategorySet = new Set(targetCategories);
  const now = options.now || new Date().toISOString();
  const maxReferencesPerItem = Math.max(1, options.maxReferencesPerItem || DEFAULT_MAX_REFERENCES);
  const minScore = Math.max(0, options.minScore || DEFAULT_MIN_SCORE);
  const requireOfficialReference = options.requireOfficialReference !== false;

  const keptQaRecords = qaRecords.filter((item) => !getDatasetKnowledgeDropReason(item));
  const candidates = authorityRecords
    .map((record) => toAuthorityCandidate(record))
    .filter((candidate): candidate is AuthorityCandidate => Boolean(candidate));

  const records = keptQaRecords.map((item) => {
    if (!targetCategorySet.has(item.category)) {
      return {
        ...item,
        source_class: item.source_class || 'dataset',
        source_org: item.source_org || item.source || 'cMedQA2数据集',
        topic: item.topic || inferQaTopic(item),
        target_stage: Array.isArray(item.target_stage) && item.target_stage.length > 0
          ? item.target_stage
          : inferQaStages(item, item.topic || inferQaTopic(item)),
        risk_level_default: inferQaRiskLevel(item),
      };
    }

    const matches = findAuthorityMatches(item, candidates, {
      maxReferencesPerItem,
      minScore,
      requireOfficialReference,
    });

    return enrichItem(item, matches, now);
  });

  const targetRecords = records.filter((item) => targetCategorySet.has(item.category));
  const enriched = targetRecords.filter((item) => (
    Array.isArray(item.references)
    && item.references.some((ref) => ref.authoritative === true || ref.sourceClass === 'official')
  )).length;

  return {
    records,
    report: {
      total: qaRecords.length,
      kept: keptQaRecords.length,
      dropped: qaRecords.length - keptQaRecords.length,
      authorityInput: authorityRecords.length,
      authorityUsable: candidates.length,
      targetCategories,
      targetTotal: targetRecords.length,
      enriched,
      missingTargetCoverage: targetRecords.length - enriched,
      coverageRate: Number(((enriched / Math.max(targetRecords.length, 1)) * 100).toFixed(2)),
      coverageByCategory: buildCoverageByCategory(records, targetCategorySet),
    },
  };
}

export const __knowledgeEnrichmentTestUtils = {
  inferQaTopic,
  inferQaStages,
  inferQaRiskLevel,
  toAuthorityCandidate,
};

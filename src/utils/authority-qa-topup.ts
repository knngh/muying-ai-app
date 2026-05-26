import { detectRiskLevelDefault } from '../services/authority-adapters/base.adapter';
import type { AuthorityReference, KnowledgeRiskLevel, QAPair } from '../services/knowledge.service';
import { getAuthorityKnowledgeDropReason, getDatasetKnowledgeDropReason } from './knowledge-content-guard';
import { shouldFilterAuthoritySourceUrl } from './authority-source-url';
import { inferAuthorityStages, type AuthorityStage } from './authority-stage';

type SourceClass = NonNullable<QAPair['source_class']>;

export interface AuthorityTranslationCacheRecord {
  translatedTitle?: string;
  translatedSummary?: string;
  translatedContent?: string;
  isSourceChinese?: boolean;
}

export type AuthorityTranslationCache = Record<string, AuthorityTranslationCacheRecord>;

export interface AuthorityQaTopupOptions {
  targetCount?: number;
  now?: string;
  requireOfficialSource?: boolean;
  requireChineseMaterial?: boolean;
  maxGeneratedPerAuthority?: number;
}

export interface AuthorityQaTopupReport {
  targetCount: number;
  existing: number;
  existingKept: number;
  existingDropped: number;
  needed: number;
  authorityInput: number;
  authorityUsable: number;
  generated: number;
  refreshedGenerated: number;
  finalTotal: number;
  remainingGap: number;
  skipped: Record<string, number>;
  generatedByTemplate: Record<string, number>;
  generatedByCategory: Record<string, number>;
  sampleIds: string[];
}

export interface AuthorityQaTopupResult {
  records: QAPair[];
  additions: QAPair[];
  report: AuthorityQaTopupReport;
}

interface NormalizedAuthorityRecord extends QAPair {
  title: string;
  material: string;
  sourceClass: SourceClass;
  source_updated_at?: string;
  stages: AuthorityStage[];
}

interface TopupTemplate {
  id: string;
  buildQuestion: (params: { context: string; title: string }) => string;
  answerFocus: string;
}

const DEFAULT_TARGET_COUNT = 5000;
const DEFAULT_MAX_GENERATED_PER_AUTHORITY = 7;

const OFFICIAL_SOURCE_PATTERN = /who\.int|cdc\.gov|healthychildren\.org|aap|acog\.org|mayoclinic\.org|msdmanuals\.cn|nhs\.uk|nih\.gov|fda\.gov|nhc\.gov\.cn|chinacdc\.cn|ndcpa\.gov\.cn|gov\.cn|ncwchnhc\.org\.cn|mchscn\.cn|cnsoc\.org|chinanutri\.cn|cma\.org\.cn|中华医学会|中国疾病预防控制中心|国家卫生健康委员会|国家卫健委|中国营养学会/i;

const ALLOWED_TOPICS = new Set([
  'pregnancy',
  'postpartum',
  'newborn',
  'feeding',
  'vaccination',
  'development',
  'common-symptoms',
]);

const TOPUP_TEMPLATES: TopupTemplate[] = [
  {
    id: 'key-points',
    buildQuestion: ({ context, title }) => `${context}，关于《${title}》需要了解哪些要点？`,
    answerFocus: '核心要点',
  },
  {
    id: 'daily-care',
    buildQuestion: ({ context, title }) => `${context}遇到《${title}》相关情况，日常护理可以关注什么？`,
    answerFocus: '日常观察与护理',
  },
  {
    id: 'professional-help',
    buildQuestion: ({ context, title }) => `关于《${title}》，${context}什么时候需要咨询医生或专业人员？`,
    answerFocus: '需要进一步咨询的边界',
  },
  {
    id: 'observation-records',
    buildQuestion: ({ context, title }) => `${context}参考《${title}》时，可以记录哪些观察信息？`,
    answerFocus: '建议记录的信息',
  },
  {
    id: 'family-reminders',
    buildQuestion: ({ context, title }) => `阅读《${title}》后，${context}有哪些容易忽略的提醒？`,
    answerFocus: '家庭照护提醒',
  },
  {
    id: 'doctor-communication',
    buildQuestion: ({ context, title }) => `${context}参考《${title}》时，和医生沟通前可以整理哪些信息？`,
    answerFocus: '沟通前的信息整理',
  },
  {
    id: 'related-learning',
    buildQuestion: ({ context, title }) => `${context}阅读《${title}》后，还可以继续了解哪些相关知识？`,
    answerFocus: '延伸了解方向',
  },
];

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] || 0) + 1;
}

function compactText(input: string | undefined, maxLength = 1200): string {
  return (input || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#58;/g, ':')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeForDedupe(input: string): string {
  return input
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/gi, '')
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, '')
    .trim();
}

function hasChineseText(input: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff]/u.test(input);
}

function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function isOfficialAuthority(record: QAPair): boolean {
  if (record.source_class === 'official') {
    return true;
  }

  const sourceText = [
    record.source_id,
    record.source_org,
    record.source,
    record.source_url,
    record.url,
  ].filter(Boolean).join(' ');

  return OFFICIAL_SOURCE_PATTERN.test(sourceText);
}

function resolveSourceClass(record: QAPair): SourceClass {
  if (isOfficialAuthority(record)) {
    return 'official';
  }
  if (record.source_class === 'medical_platform' || record.source_class === 'dataset' || record.source_class === 'unknown') {
    return record.source_class;
  }
  return 'unknown';
}

function resolveTopic(record: QAPair): string {
  const topic = (record.topic || record.category || '').trim().toLowerCase();
  if (topic === 'authority' || topic === 'general') {
    return '';
  }
  return topic;
}

function resolveStages(record: QAPair, title: string, material: string, topic: string): AuthorityStage[] {
  const existing = Array.isArray(record.target_stage)
    ? record.target_stage.filter((stage): stage is AuthorityStage => typeof stage === 'string')
    : [];
  if (existing.length > 0) {
    return existing;
  }

  return inferAuthorityStages({
    title,
    summary: compactText((record as { summary?: string }).summary, 240),
    contentText: material,
    audience: record.audience,
    topic,
  });
}

function getTranslationForRecord(
  record: QAPair,
  translationCache: AuthorityTranslationCache,
): AuthorityTranslationCacheRecord | undefined {
  const keys = [
    record.id,
    record.original_id,
    record.source_url,
    record.url,
  ].filter((item): item is string => Boolean(item));

  for (const key of keys) {
    const value = translationCache[key];
    if (value) {
      return value;
    }
  }

  return undefined;
}

function normalizeAuthorityRecord(
  record: QAPair,
  translationCache: AuthorityTranslationCache,
  options: Required<Pick<AuthorityQaTopupOptions, 'requireOfficialSource' | 'requireChineseMaterial'>>,
  skipped: Record<string, number>,
): NormalizedAuthorityRecord | null {
  if (!record.question || !record.answer || record.status !== 'published') {
    increment(skipped, 'not_published_or_empty');
    return null;
  }

  const sourceClass = resolveSourceClass(record);
  if (options.requireOfficialSource && sourceClass !== 'official') {
    increment(skipped, 'not_official');
    return null;
  }

  if (shouldFilterAuthoritySourceUrl(record) || getAuthorityKnowledgeDropReason(record)) {
    increment(skipped, 'guard_rejected_authority');
    return null;
  }

  const translation = getTranslationForRecord(record, translationCache);
  const sourceTitle = compactText(record.question, 120);
  const rawTranslatedTitle = compactText(translation?.translatedTitle, 120);
  const translationLifecycleMismatch = hasTranslationTitleLifecycleMismatch(record, rawTranslatedTitle);
  if (translationLifecycleMismatch) {
    increment(skipped, 'translation_title_lifecycle_mismatch');
  }
  const translatedTitle = translationLifecycleMismatch ? '' : rawTranslatedTitle;
  const title = translatedTitle || sourceTitle;
  const material = compactText([
    translationLifecycleMismatch ? undefined : translation?.translatedSummary,
    translationLifecycleMismatch ? undefined : translation?.translatedContent,
    (record as { summary?: string }).summary,
    record.answer,
  ].filter(Boolean).join(' '), 1600);

  if (!title || material.length < 80) {
    increment(skipped, 'low_information_material');
    return null;
  }

  if (options.requireChineseMaterial && (!hasChineseText(title) || !hasChineseText(material))) {
    increment(skipped, 'missing_chinese_material');
    return null;
  }

  const topic = resolveTopic(record);
  if (!ALLOWED_TOPICS.has(topic)) {
    increment(skipped, 'unsupported_topic');
    return null;
  }

  const stages = resolveStages(record, title, material, topic);
  return {
    ...record,
    title,
    material,
    topic,
    sourceClass,
    stages,
  };
}

function hasChildMedicationOrSymptomSignal(text: string): boolean {
  return /儿童|孩子|宝宝|婴儿|婴幼儿|幼儿|小儿|child|children|infant|baby|pediatric|paediatric/i.test(text)
    && /用药|药物|药品|退烧药|退热药|止痛|疼痛|发热|发烧|高热|布洛芬|对乙酰氨基酚|medicine|medication|drug|ibuprofen|acetaminophen|paracetamol|pain|fever/i.test(text);
}

function hasExplicitPregnancyTitleSignal(title: string): boolean {
  return /孕期|孕妇|怀孕|妊娠|prenatal|pregnan/i.test(title);
}

function hasPregnancyMedicineSourceSignal(text: string): boolean {
  return /孕期|孕妇|怀孕|妊娠|哺乳|生育|pregnancy|pregnant|breastfeeding|fertility|prenatal|medicine-and-pregnancy|pregnancy-breastfeeding-and-fertility/i.test(text);
}

function hasChildMedicationTitleSignal(title: string): boolean {
  return /儿童|孩子|宝宝|婴儿|婴幼儿|幼儿|小儿|child|children|infant|baby|pediatric|paediatric/i.test(title)
    && /用药|药物|药品|退烧药|退热药|止痛|疼痛|发热|发烧|高热|布洛芬|对乙酰氨基酚|medicine|medication|drug|ibuprofen|acetaminophen|paracetamol|co-codamol|pain|fever/i.test(title);
}

function hasTranslationTitleLifecycleMismatch(record: QAPair, translatedTitle: string): boolean {
  if (!translatedTitle) {
    return false;
  }

  const sourceText = [
    record.question,
    record.source_url,
    record.url,
    record.original_id,
  ].filter(Boolean).join(' ');

  const translatedChildMedication = hasChildMedicationTitleSignal(translatedTitle);
  const sourceChildMedication = hasChildMedicationTitleSignal(sourceText);
  const translatedPregnancyMedicine = hasPregnancyMedicineSourceSignal(translatedTitle);
  const sourcePregnancyMedicine = hasPregnancyMedicineSourceSignal(sourceText);

  return (translatedChildMedication && sourcePregnancyMedicine && !sourceChildMedication)
    || (translatedPregnancyMedicine && sourceChildMedication && !sourcePregnancyMedicine);
}

function resolveCategory(record: NormalizedAuthorityRecord): string {
  const stageSet = new Set(record.stages);
  const topic = record.topic || record.category || '';
  const text = `${record.title} ${record.material} ${record.audience || ''}`;
  const childMedicationOrSymptom = !hasExplicitPregnancyTitleSignal(record.title)
    && hasChildMedicationTitleSignal(record.title);

  if (childMedicationOrSymptom && topic !== 'pregnancy' && topic !== 'postpartum') {
    return 'common-symptoms';
  }

  if (topic === 'postpartum' || stageSet.has('postpartum') || /产后|哺乳|恶露|乳腺炎/u.test(text)) {
    return 'pregnancy-birth';
  }

  if (topic === 'pregnancy') {
    if (stageSet.has('preparation') || /备孕|孕前|叶酸/u.test(text)) return 'pregnancy-prep';
    if (stageSet.has('first-trimester') || /孕早期|早孕|first trimester/i.test(text)) return 'pregnancy-early';
    if (stageSet.has('second-trimester') || /孕中期|second trimester/i.test(text)) return 'pregnancy-mid';
    if (stageSet.has('third-trimester') || /孕晚期|third trimester|分娩|临产/u.test(text)) return 'pregnancy-late';
    return 'pregnancy-mid';
  }

  if (topic === 'newborn') {
    return 'parenting-newborn';
  }

  if (topic === 'feeding') {
    if (!childMedicationOrSymptom && (/孕|pregnan|prenatal/i.test(text) || stageSet.has('first-trimester') || stageSet.has('second-trimester') || stageSet.has('third-trimester'))) {
      return 'nutrition-pregnancy';
    }
    if (stageSet.has('1-3-years') || stageSet.has('3-years-plus')) {
      return 'nutrition-child';
    }
    return 'nutrition-baby';
  }

  if (topic === 'vaccination') {
    if (/反应|不良反应|副作用|发热|红肿|reaction|side effects?/i.test(text)) {
      return 'vaccine-reaction';
    }
    return 'vaccine-schedule';
  }

  if (topic === 'development') {
    if (stageSet.has('newborn')) return 'parenting-newborn';
    if (stageSet.has('0-6-months') || stageSet.has('6-12-months')) return 'parenting-0-1';
    if (stageSet.has('1-3-years')) return 'parenting-1-3';
    if (stageSet.has('3-years-plus')) return 'parenting-3-6';
    return 'common-development';
  }

  if (/安全|safe|injury|sleep|crib/i.test(text)) {
    return 'common-safety';
  }

  return 'common-symptoms';
}

function resolveContext(record: NormalizedAuthorityRecord, category: string): string {
  if (category.startsWith('pregnancy') || record.topic === 'pregnancy' || record.topic === 'postpartum') {
    if (category === 'pregnancy-prep') return '备孕和孕前准备中';
    if (category === 'pregnancy-birth') return '分娩、产后或哺乳阶段';
    return '孕期';
  }

  if (category.startsWith('vaccine')) {
    return '宝宝疫苗接种中';
  }

  if (category.startsWith('nutrition')) {
    if (category === 'nutrition-pregnancy') return '孕期营养安排中';
    return '宝宝喂养中';
  }

  if (category === 'parenting-newborn') return '新生儿护理中';
  if (category === 'parenting-1-3') return '幼儿照护中';
  if (category === 'parenting-3-6') return '学龄前儿童照护中';
  return '宝宝护理中';
}

function resolveTags(record: NormalizedAuthorityRecord, category: string): string[] {
  const tags = new Set<string>();
  if (category.startsWith('pregnancy')) tags.add('孕期');
  if (category.startsWith('parenting')) tags.add('育儿');
  if (category.startsWith('nutrition')) tags.add('营养');
  if (category.startsWith('vaccine')) tags.add('疫苗');
  if (category.startsWith('common')) tags.add('母婴');
  for (const tag of record.tags || []) {
    if (tag && tags.size < 5) {
      tags.add(tag);
    }
  }
  return Array.from(tags).slice(0, 5);
}

function splitChineseSentences(text: string): string[] {
  const normalized = compactText(text, 1400);
  const matches = normalized.match(/[^。！？!?；;]{18,180}[。！？!?；;]?/gu) || [];
  return matches
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 18)
    .slice(0, 4);
}

function buildAnswer(
  record: NormalizedAuthorityRecord,
  template: TopupTemplate,
  category: string,
): string {
  const org = record.source_org || record.source || '权威机构';
  const title = record.title;
  const sentences = splitChineseSentences(record.material);
  const selected = sentences.length > 0
    ? sentences.slice(0, 3).join('')
    : compactText(record.material, 360);
  const contextAdvice = category.startsWith('pregnancy')
    ? '同时结合孕周、产检记录和自身症状变化判断；如果出现持续不适、明显加重或拿不准的情况，请及时咨询产科医生。'
    : '同时结合宝宝月龄、精神状态、吃奶睡眠和症状变化判断；如果出现持续不适、明显加重或家长拿不准的情况，请及时咨询儿科医生或儿保人员。';

  return [
    `**${template.answerFocus}：**`,
    '',
    `根据${org}资料《${title}》整理，${selected}`,
    '',
    contextAdvice,
    '',
    `来源：${org}《${title}》。本内容用于科普和辅助理解，不替代医生面诊或个体化医疗建议。`,
  ].join('\n');
}

function inferRiskLevel(record: NormalizedAuthorityRecord, question: string): KnowledgeRiskLevel {
  if (record.risk_level_default) {
    return record.risk_level_default;
  }

  if (/发热|发烧|咳嗽|腹泻|呕吐|皮疹|湿疹|黄疸|出血|宫缩|破水|胎动|疫苗|接种|过敏|fever|diarrhea|vomit|rash|bleeding|vaccine/i.test(`${question} ${record.title}`)) {
    return 'yellow';
  }

  return detectRiskLevelDefault(`${question} ${record.title}`);
}

function buildReference(record: NormalizedAuthorityRecord): AuthorityReference {
  return {
    title: record.title,
    url: record.source_url || record.url,
    org: record.source_org || record.source,
    sourceOrg: record.source_org || record.source,
    sourceClass: record.sourceClass,
    authoritative: record.sourceClass === 'official',
    excerpt: compactText(record.material, 220),
  };
}

function buildTopupRecord(
  record: NormalizedAuthorityRecord,
  template: TopupTemplate,
  now: string,
): QAPair {
  const category = resolveCategory(record);
  const context = resolveContext(record, category);
  const question = template.buildQuestion({ context, title: record.title });
  const sourceKey = record.source_url || record.url || record.original_id || record.id;
  const id = `qa-authority-topup-${simpleHash(`${sourceKey}:${template.id}`)}-${template.id}`;

  return {
    id,
    content_type: 'qa',
    question,
    answer: buildAnswer(record, template, category),
    category,
    tags: resolveTags(record, category),
    target_stage: record.stages,
    difficulty: 'beginner',
    read_time: 3,
    author: {
      name: 'AI助手',
      title: '权威资料整理',
    },
    is_verified: false,
    status: 'published',
    view_count: 0,
    like_count: 0,
    created_at: now,
    updated_at: now,
    published_at: now,
    source: '权威资料补齐',
    source_id: record.source_id,
    source_org: record.source_org || record.source,
    source_class: record.sourceClass,
    source_url: record.source_url || record.url,
    url: record.source_url || record.url,
    audience: record.audience,
    topic: record.topic,
    risk_level_default: inferRiskLevel(record, question),
    region: record.region,
    metadata: {
      generatedBy: 'authority-qa-topup',
      generatedFromAuthorityId: record.id,
      generatedTemplate: template.id,
      sourceUpdatedAt: record.source_updated_at || record.updated_at || record.published_at,
    },
    references: [buildReference(record)],
    original_id: `authority-topup:${record.id}:${template.id}`,
  };
}

function isStaleGeneratedTopupLifecycleMismatch(record: QAPair): boolean {
  if (!isGeneratedTopupRecord(record)) {
    return false;
  }

  const title = extractTopupTitle(record);
  if (!hasChildMedicationTitleSignal(title)) {
    return false;
  }

  const sourceText = buildTopupSourceIdentityText(record);
  return hasPregnancyMedicineSourceSignal(sourceText);
}

function filterKept(records: QAPair[]): QAPair[] {
  return records.filter((record) => (
    !getDatasetKnowledgeDropReason(record)
    && !isStaleGeneratedTopupLifecycleMismatch(record)
  ));
}

function isGeneratedTopupRecord(record: QAPair): boolean {
  return record.metadata?.generatedBy === 'authority-qa-topup'
    || record.original_id?.startsWith('authority-topup:')
    || record.id?.startsWith('qa-authority-topup-');
}

function mergeRefreshedTopupRecord(existing: QAPair, candidate: QAPair): QAPair {
  return {
    ...candidate,
    id: existing.id || candidate.id,
    created_at: existing.created_at || candidate.created_at,
    published_at: existing.published_at || candidate.published_at,
    view_count: existing.view_count || 0,
    like_count: existing.like_count || 0,
  };
}

function hasMeaningfulTopupChange(existing: QAPair, candidate: QAPair): boolean {
  return existing.question !== candidate.question
    || existing.answer !== candidate.answer
    || existing.category !== candidate.category
    || JSON.stringify(existing.tags || []) !== JSON.stringify(candidate.tags || [])
    || JSON.stringify(existing.target_stage || []) !== JSON.stringify(candidate.target_stage || [])
    || existing.source_url !== candidate.source_url
    || existing.url !== candidate.url
    || existing.source_id !== candidate.source_id
    || existing.source_org !== candidate.source_org
    || existing.source_class !== candidate.source_class
    || existing.topic !== candidate.topic
    || existing.risk_level_default !== candidate.risk_level_default
    || JSON.stringify(existing.references || []) !== JSON.stringify(candidate.references || []);
}

function extractTopupTitle(record: QAPair): string {
  const fromQuestion = (record.question || '').match(/《([^》]+)》/u)?.[1];
  if (fromQuestion) {
    return fromQuestion.trim();
  }

  const fromReference = record.references?.find((reference) => reference.title)?.title;
  return (fromReference || '').trim();
}

function buildTopupSourceText(record: QAPair): string {
  return [
    record.question,
    record.source_url,
    record.url,
    record.original_id,
    record.metadata?.generatedFromAuthorityId,
    ...(record.references || []).flatMap((reference) => [
      reference.title,
      reference.url,
      reference.sourceOrg,
      reference.org,
    ]),
  ].filter(Boolean).join(' ');
}

function buildTopupSourceIdentityText(record: QAPair): string {
  return [
    record.source_url,
    record.url,
    record.original_id,
    record.metadata?.generatedFromAuthorityId,
    ...(record.references || []).flatMap((reference) => [
      reference.url,
      reference.sourceOrg,
      reference.org,
    ]),
  ].filter(Boolean).join(' ');
}

function shouldRefreshGeneratedTopupRecord(
  existing: QAPair,
  candidate: QAPair,
  options: { matchedByQuestion?: boolean } = {},
): boolean {
  if (!hasMeaningfulTopupChange(existing, candidate)) {
    return false;
  }

  const title = extractTopupTitle(candidate) || extractTopupTitle(existing);
  const existingText = `${existing.question || ''} ${existing.category || ''}`;
  if (existing.category === 'nutrition-pregnancy'
    && candidate.category === 'common-symptoms'
    && /孕期营养安排中/u.test(existingText)
    && hasChildMedicationTitleSignal(title)) {
    return true;
  }

  if (!options.matchedByQuestion) {
    return false;
  }

  const normalizedExistingTitle = normalizeForDedupe(extractTopupTitle(existing));
  const normalizedCandidateTitle = normalizeForDedupe(extractTopupTitle(candidate));
  if (!normalizedExistingTitle || normalizedExistingTitle !== normalizedCandidateTitle) {
    return false;
  }

  const existingSourceText = buildTopupSourceIdentityText(existing);
  const candidateSourceText = buildTopupSourceIdentityText(candidate);
  return hasChildMedicationTitleSignal(title)
    && hasPregnancyMedicineSourceSignal(existingSourceText)
    && !hasPregnancyMedicineSourceSignal(candidateSourceText);
}

export function generateAuthorityQaTopup(
  existingRecords: QAPair[],
  authorityRecords: QAPair[],
  translationCache: AuthorityTranslationCache = {},
  options: AuthorityQaTopupOptions = {},
): AuthorityQaTopupResult {
  const targetCount = Math.max(0, options.targetCount || DEFAULT_TARGET_COUNT);
  const now = options.now || new Date().toISOString();
  const requireOfficialSource = options.requireOfficialSource !== false;
  const requireChineseMaterial = options.requireChineseMaterial !== false;
  const maxGeneratedPerAuthority = Math.max(1, options.maxGeneratedPerAuthority || DEFAULT_MAX_GENERATED_PER_AUTHORITY);
  const keptExistingRecords = filterKept(existingRecords);
  const records = keptExistingRecords.slice();
  const existingKept = keptExistingRecords.length;
  const existingDropped = existingRecords.length - existingKept;
  const needed = Math.max(0, targetCount - existingKept);
  const existingGeneratedTopupCount = keptExistingRecords.filter(isGeneratedTopupRecord).length;
  let refreshedGenerated = 0;
  const skipped: Record<string, number> = {};
  const generatedByTemplate: Record<string, number> = {};
  const generatedByCategory: Record<string, number> = {};
  const existingIds = new Set(records.map((record) => record.id).filter(Boolean));
  const existingQuestions = new Set(records.map((record) => normalizeForDedupe(record.question)).filter(Boolean));
  const existingOriginalIds = new Set(records.map((record) => record.original_id).filter(Boolean));
  const existingGeneratedIndexById = new Map<string, number>();
  const existingGeneratedIndexByOriginalId = new Map<string, number>();
  const existingGeneratedIndexByQuestion = new Map<string, number>();
  const additions: QAPair[] = [];

  records.forEach((record, index) => {
    if (!isGeneratedTopupRecord(record)) {
      return;
    }
    if (record.id) {
      existingGeneratedIndexById.set(record.id, index);
    }
    if (record.original_id) {
      existingGeneratedIndexByOriginalId.set(record.original_id, index);
    }
    const normalizedQuestion = normalizeForDedupe(record.question || '');
    if (normalizedQuestion) {
      existingGeneratedIndexByQuestion.set(normalizedQuestion, index);
    }
  });

  if (needed === 0 && existingGeneratedTopupCount === 0) {
    return {
      records: existingDropped > 0 ? keptExistingRecords : existingRecords,
      additions,
      report: {
        targetCount,
        existing: existingRecords.length,
        existingKept,
        existingDropped,
        needed: 0,
        authorityInput: authorityRecords.length,
        authorityUsable: 0,
        generated: 0,
        refreshedGenerated: 0,
        finalTotal: existingKept,
        remainingGap: 0,
        skipped,
        generatedByTemplate,
        generatedByCategory,
        sampleIds: [],
      },
    };
  }

  const usableAuthority = authorityRecords
    .map((record) => normalizeAuthorityRecord(record, translationCache, { requireOfficialSource, requireChineseMaterial }, skipped))
    .filter((record): record is NormalizedAuthorityRecord => Boolean(record))
    .sort((left, right) => {
      const leftUpdated = Date.parse(left.source_updated_at || left.updated_at || left.published_at || left.created_at || '') || 0;
      const rightUpdated = Date.parse(right.source_updated_at || right.updated_at || right.published_at || right.created_at || '') || 0;
      return rightUpdated - leftUpdated || left.id.localeCompare(right.id);
    });

  for (const authority of usableAuthority) {
    const templates = TOPUP_TEMPLATES.slice(0, maxGeneratedPerAuthority);
    for (const template of templates) {
      const candidate = buildTopupRecord(authority, template, now);
      const normalizedQuestion = normalizeForDedupe(candidate.question);
      const generatedRecordIndexByOriginalId = existingGeneratedIndexByOriginalId.get(candidate.original_id);
      const generatedRecordIndexById = existingGeneratedIndexById.get(candidate.id);
      const generatedRecordIndexByQuestion = existingGeneratedIndexByQuestion.get(normalizedQuestion);
      const generatedRecordIndex = generatedRecordIndexByOriginalId
        ?? generatedRecordIndexById
        ?? generatedRecordIndexByQuestion;
      const matchedByQuestion = generatedRecordIndex != null
        && generatedRecordIndexByOriginalId == null
        && generatedRecordIndexById == null
        && generatedRecordIndexByQuestion === generatedRecordIndex;

      if (generatedRecordIndex != null) {
        const existingGenerated = records[generatedRecordIndex];
        if (existingGenerated && shouldRefreshGeneratedTopupRecord(existingGenerated, candidate, { matchedByQuestion })) {
          records[generatedRecordIndex] = mergeRefreshedTopupRecord(existingGenerated, candidate);
          refreshedGenerated += 1;
          if (candidate.original_id) {
            existingGeneratedIndexByOriginalId.set(candidate.original_id, generatedRecordIndex);
          }
        }
        existingIds.add(candidate.id);
        existingQuestions.add(normalizedQuestion);
        existingOriginalIds.add(candidate.original_id);
        continue;
      }

      if (additions.length >= needed) {
        continue;
      }

      if (existingIds.has(candidate.id)) {
        increment(skipped, 'duplicate_id');
        continue;
      }
      if (existingQuestions.has(normalizedQuestion)) {
        increment(skipped, 'duplicate_question');
        continue;
      }
      if (existingOriginalIds.has(candidate.original_id)) {
        increment(skipped, 'duplicate_original_id');
        continue;
      }

      const dropReason = getDatasetKnowledgeDropReason(candidate);
      if (dropReason) {
        increment(skipped, `dataset_guard:${dropReason}`);
        continue;
      }

      additions.push(candidate);
      existingIds.add(candidate.id);
      existingQuestions.add(normalizedQuestion);
      existingOriginalIds.add(candidate.original_id);
      increment(generatedByTemplate, template.id);
      increment(generatedByCategory, candidate.category);
    }

    if (additions.length >= needed && refreshedGenerated >= existingGeneratedTopupCount) {
      break;
    }
  }

  const finalRecords = records.concat(additions);
  return {
    records: finalRecords,
    additions,
    report: {
      targetCount,
      existing: existingRecords.length,
      existingKept,
      existingDropped,
      needed,
      authorityInput: authorityRecords.length,
      authorityUsable: usableAuthority.length,
      generated: additions.length,
      refreshedGenerated,
      finalTotal: finalRecords.length,
      remainingGap: Math.max(0, targetCount - (existingKept + additions.length)),
      skipped,
      generatedByTemplate,
      generatedByCategory,
      sampleIds: additions.slice(0, 10).map((record) => record.id),
    },
  };
}

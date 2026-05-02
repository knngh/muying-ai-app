type KnowledgeTagLike = string | { name?: string; slug?: string };

export interface SensitiveKnowledgeRecord {
  title?: string | null;
  question?: string | null;
  summary?: string | null;
  content?: string | null;
  answer?: string | null;
  category?: string | null;
  topic?: string | null;
  tags?: KnowledgeTagLike[] | null;
  source?: string | null;
  sourceOrg?: string | null;
  source_org?: string | null;
  sourceId?: string | null;
  source_id?: string | null;
  sourceUrl?: string | null;
  source_url?: string | null;
  url?: string | null;
}

const DEATH_RELATED_ZH_PATTERN = /死亡|死产|胎死|胎停|稽留流产|致死|猝死|身亡|溺亡|窒息死|遗体|讣告|殉职|殉难|哀悼|遇难|罹难|逝世|去世|过世|病故|早夭|夭折|死胎|尸检|尸体|要命/u;

const DEATH_RELATED_EN_PATTERN = /\b(?:deaths?|died|dying|deceased|fatal|fatality|fatalities|stillbirths?|stillborn|mortality|demise|perinatal\s+mortality|neonatal\s+deaths?|infant\s+deaths?|sudden\s+infant\s+death|sids|miscarriages?|stillbirth)\b/i;

const HIGH_SENSITIVITY_TOPIC_PATTERN = /胎死(?:腹中|宫内)?|胎停(?:育)?|稽留流产|胎儿宫内死亡|胎儿畸形(?:引产|终止妊娠)|引产案例|引产经历|堕胎(?:经历|过程|手术)|遗腹子/u;

const SENSATIONAL_LANGUAGE_PATTERN = /(?:很要命|后患无穷|致命|可怕|惊人|惊悚|惊呆|噩耗|崩溃|惨剧|惨痛|血淋淋|绝症|悲剧|越来越多|不敢相信|高度警惕|都怪|这件事能|赶紧拿|赶紧用|分分钟|惊天|揪心|哭了|崩溃了|无人不知|无人不晓|惊曝|曝光|警惕!|当心!|千万别|太可怕|必看|秒懂|不妨试试|绝招|招数|支招|智力受损|补脑|不防不行|妈妈要早知|值得家长一看)/u;

const PSEUDO_MEDICAL_GENDER_SELECTION_PATTERN = /(?:备孕|怀孕|二胎|三胎|想要|要想|准备)[^，。！？]{0,8}(?:男孩|女孩|男宝|女宝|男娃|女娃|儿子)(?![名个])|(?:生|怀|要)(?:个)?(?:男孩|女孩|男宝|女宝|男娃|女娃)(?:[^，。！？]{0,12}(?:秘诀|偏方|方法|妙招|妙方|技巧|吃什么|怎么吃|食谱|配方|攻略|科学|备孕|攻略|攻略)|$|？|\?)|(?:男孩|女孩|男宝|女宝)[^，。！？]{0,6}(?:秘诀|偏方|妙方)|生男生女(?:秘诀|预测|看|早知道|提前知道)|清宫(?:表|图)预测|(?:酸性体质|碱性体质)[^，。！？]{0,8}(?:生男|生女|男孩|女孩)/u;

const PSEUDO_MEDICAL_QUACK_PATTERN = /(?:转骨|穿胎|安胎药偏方)|快速.{0,4}(?:根治|痊愈|康复)|根治.{0,4}(?:湿疹|肾病|白血病|脑瘫)|包治|祖传秘方|神奇.{0,4}(?:配方|方法|偏方)/u;

function normalizeText(input?: string | null): string {
  return (input || '').replace(/\s+/g, ' ').trim();
}

function getRecordTitle(record: SensitiveKnowledgeRecord): string {
  return normalizeText(record.title || record.question);
}

function normalizeTag(tag: KnowledgeTagLike): string {
  return typeof tag === 'string' ? tag : `${tag.name || ''} ${tag.slug || ''}`;
}

export function getSensitiveKnowledgeText(record: SensitiveKnowledgeRecord): string {
  return [
    record.title,
    record.question,
    record.summary,
    record.content,
    record.answer,
    record.category,
    record.topic,
    ...(record.tags || []).map(normalizeTag),
    record.source,
    record.sourceOrg,
    record.source_org,
    record.sourceId,
    record.source_id,
  ].map((item) => normalizeText(item)).filter(Boolean).join(' ');
}

export function containsDeathRelatedTerms(text: string): boolean {
  if (!text) {
    return false;
  }

  return DEATH_RELATED_ZH_PATTERN.test(text) || DEATH_RELATED_EN_PATTERN.test(text);
}

export function isHighRiskOrClickbaitTitle(title: string): string | null {
  const normalized = normalizeText(title).replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  if (!normalized) {
    return null;
  }

  if (containsDeathRelatedTerms(normalized)) {
    return 'death_related_term';
  }

  if (HIGH_SENSITIVITY_TOPIC_PATTERN.test(normalized)) {
    return 'high_sensitivity_topic';
  }

  if (PSEUDO_MEDICAL_GENDER_SELECTION_PATTERN.test(normalized)) {
    return 'pseudo_medical_gender_selection';
  }

  if (PSEUDO_MEDICAL_QUACK_PATTERN.test(normalized)) {
    return 'pseudo_medical_claim';
  }

  if (SENSATIONAL_LANGUAGE_PATTERN.test(normalized)) {
    return 'sensational_clickbait';
  }

  return null;
}

export function getSensitiveKnowledgeDropReason(record: SensitiveKnowledgeRecord): string | null {
  const titleReason = isHighRiskOrClickbaitTitle(getRecordTitle(record));
  if (titleReason) {
    return titleReason;
  }

  const text = getSensitiveKnowledgeText(record);
  if (containsDeathRelatedTerms(text)) {
    return 'death_related_term';
  }

  if (HIGH_SENSITIVITY_TOPIC_PATTERN.test(text)) {
    return 'high_sensitivity_topic';
  }

  return null;
}

export function isSensitiveKnowledgeQuery(query: string): boolean {
  const normalized = normalizeText(query);
  if (!normalized) {
    return false;
  }

  return containsDeathRelatedTerms(normalized)
    || Boolean(isHighRiskOrClickbaitTitle(normalized))
    || HIGH_SENSITIVITY_TOPIC_PATTERN.test(normalized);
}

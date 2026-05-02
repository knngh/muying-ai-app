import { getMedicalPlatformQualityDropReason } from './medical-platform-quality';

export interface KnowledgeGuardRecord {
  title?: string;
  question?: string;
  answer?: string;
  summary?: string;
  content?: string;
  contentText?: string;
  category?: string;
  tags?: string[];
  source?: string;
  sourceOrg?: string;
  source_org?: string;
  sourceId?: string;
  source_id?: string;
  sourceClass?: string;
  source_class?: string;
  sourceUrl?: string;
  source_url?: string;
  url?: string;
  source_updated_at?: string;
  updated_at?: string;
  updatedAt?: string;
  published_at?: string;
  created_at?: string;
}

const PRODUCT_SCOPE_PATTERN = /怀孕|孕妇|孕期|孕早期|孕中期|孕晚期|孕周|产检|胎儿|胎动|胎心|宫缩|破水|预产期|分娩|顺产|剖宫产|产后|坐月子|月子|哺乳|母乳|备孕|孕前|叶酸|排卵|宝宝|婴儿|新生儿|幼儿|小孩|孩子|月龄|辅食|喂奶|吃奶|奶量|配方奶|疫苗|接种|预防针|黄疸|脐带|湿疹|尿布|纸尿裤/u;

const OFF_SCOPE_ADULT_HEALTH_PATTERN = /阳痿|早泄|前列腺|阴茎|龟头|包皮|手淫|遗精|精液|射精|不洁性交|处女|阴道口|阴毛|性病|尖锐湿疣|梅毒|艾滋|淋病|尿道口|隆胸|丰胸|乳房下垂|飞机场|狐臭|脱发|斑秃|痔疮|肛裂|肛瘘|混合痔|内痔|外痔|脱肛|屁眼|肛门|痘痘|痤疮|美容|整形|抽脂|减肥|肾虚|心梗|癫痫|脑出血/u;

const BEYOND_CHILD_AGE_PATTERN = /青春期|青少年|中小学生|小学|初中|高中|学龄儿童|学龄期|学生近视|早恋/u;

const NON_CONTENT_PATTERN = /中文调研|调查问卷|问卷|调研|调查研究|课题研究|示范城市|民用机场|文旅|消防安全/u;

const SUPPORT_POLICY_QUERY_PATTERN = /育儿补贴|生育保险|个税|个人所得税|专项附加扣除|医保|托育服务|普惠托育|补贴申领/u;

const HIGH_SENSITIVITY_PATTERN = /人流|人工流产|引产|堕胎|清宫|宫外孕|异位妊娠|胎停|稽留流产|胎死|死胎|死产|死亡|猝死|畸形|大出血|脑内出血|缺氧|心脏发育异常|唐氏儿/u;

// Product-level blocklist for knowledge articles and authority cache records.
// Death-related terms are intentionally broad: even statistical/public-policy
// mentions such as "孕产妇死亡率" should not surface in the user-facing
// knowledge base.
const DEATH_RELATED_ZH_PATTERN = /死亡|死产|胎死|胎停|稽留流产|致死|猝死|身亡|溺亡|窒息死|遗体|讣告|殉职|殉难|哀悼|遇难|罹难|逝世|去世|过世|病故|早夭|夭折|死胎|尸检|尸体|要命/u;

const DEATH_RELATED_EN_PATTERN = /\b(?:deaths?|died|dying|deceased|fatal|fatality|fatalities|stillbirths?|stillborn|mortality|demise|perinatal\s+mortality|neonatal\s+deaths?|infant\s+deaths?|sudden\s+infant\s+death|sids|miscarriages?|stillbirth)\b/i;

const HIGH_SENSITIVITY_TOPIC_PATTERN = /胎死(?:腹中|宫内)?|胎停(?:育)?|稽留流产|胎儿宫内死亡|胎儿畸形(?:引产|终止妊娠)|引产案例|引产经历|堕胎(?:经历|过程|手术)|遗腹子/u;

const SENSATIONAL_LANGUAGE_PATTERN = /(?:很要命|后患无穷|致命|可怕|惊人|惊悚|惊呆|噩耗|崩溃|惨剧|惨痛|血淋淋|绝症|悲剧|越来越多|不敢相信|高度警惕|都怪|这件事能|赶紧拿|赶紧用|分分钟|惊天|揪心|哭了|崩溃了|无人不知|无人不晓|惊曝|曝光|警惕!|当心!|千万别|太可怕|必看|秒懂|不妨试试|绝招|招数|支招|智力受损|补脑|不防不行|妈妈要早知|值得家长一看)/u;

const PSEUDO_MEDICAL_GENDER_SELECTION_PATTERN = /(?:备孕|怀孕|二胎|三胎|想要|要想|准备)[^，。！？]{0,8}(?:男孩|女孩|男宝|女宝|男娃|女娃|儿子)(?![名个])|(?:生|怀|要)(?:个)?(?:男孩|女孩|男宝|女宝|男娃|女娃)(?:[^，。！？]{0,12}(?:秘诀|偏方|方法|妙招|妙方|技巧|吃什么|怎么吃|食谱|配方|攻略|科学|备孕|攻略|攻略)|$|？|\?)|(?:男孩|女孩|男宝|女宝)[^，。！？]{0,6}(?:秘诀|偏方|妙方)|生男生女(?:秘诀|预测|看|早知道|提前知道)|清宫(?:表|图)预测|(?:酸性体质|碱性体质)[^，。！？]{0,8}(?:生男|生女|男孩|女孩)/u;

const PSEUDO_MEDICAL_QUACK_PATTERN = /(?:转骨|穿胎|安胎药偏方)|快速.{0,4}(?:根治|痊愈|康复)|根治.{0,4}(?:湿疹|肾病|白血病|脑瘫)|包治|祖传秘方|神奇.{0,4}(?:配方|方法|偏方)/u;

function getQuestion(record: KnowledgeGuardRecord): string {
  return (record.question || record.title || '').replace(/\s+/g, ' ').trim();
}

function getRecordText(record: KnowledgeGuardRecord): string {
  return [
    record.title || '',
    record.question || '',
    record.summary || '',
    record.answer || '',
    record.content || '',
    record.contentText || '',
    record.category || '',
    ...(record.tags || []),
    record.source || '',
    record.sourceOrg || '',
    record.source_org || '',
    record.sourceId || '',
    record.source_id || '',
    record.sourceClass || '',
    record.source_class || '',
    record.sourceUrl || '',
    record.source_url || '',
    record.url || '',
  ].join(' ');
}

export function containsDeathRelatedTerms(text: string): boolean {
  if (!text) {
    return false;
  }

  return DEATH_RELATED_ZH_PATTERN.test(text) || DEATH_RELATED_EN_PATTERN.test(text);
}

export function isHighRiskOrClickbaitTitle(title: string): string | null {
  const normalized = (title || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
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

export function getAuthorityKnowledgeDropReason(record: KnowledgeGuardRecord): string | null {
  const titleReason = isHighRiskOrClickbaitTitle(getQuestion(record));
  if (titleReason) {
    return titleReason;
  }

  if (containsDeathRelatedTerms(getRecordText(record))) {
    return 'death_related_term';
  }

  if (HIGH_SENSITIVITY_TOPIC_PATTERN.test(getRecordText(record))) {
    return 'high_sensitivity_topic';
  }

  const medicalPlatformReason = getMedicalPlatformQualityDropReason({
    title: getQuestion(record),
    summary: record.summary,
    answer: record.answer || record.content,
    contentText: record.contentText,
    sourceId: record.sourceId || record.source_id,
    sourceOrg: record.sourceOrg || record.source_org,
    source: record.source,
    sourceClass: record.sourceClass || record.source_class,
    sourceUrl: record.sourceUrl || record.source_url || record.url,
    updatedAt: record.updatedAt || record.source_updated_at || record.updated_at || record.published_at || record.created_at,
  });
  if (medicalPlatformReason) {
    return medicalPlatformReason;
  }

  return null;
}

function hasProductScope(text: string): boolean {
  return PRODUCT_SCOPE_PATTERN.test(text);
}

function isPregnancyOrPostpartumContext(text: string): boolean {
  return /怀孕|孕妇|孕期|孕周|产检|胎儿|胎动|胎心|宫缩|预产期|分娩|顺产|剖宫产|产后|坐月子|月子|哺乳|母乳|备孕|孕前/u.test(text);
}

function isInfantChildCareContext(text: string): boolean {
  return /宝宝|婴儿|新生儿|幼儿|小孩|孩子|月龄|辅食|喂奶|吃奶|奶量|配方奶|疫苗|接种|预防针|黄疸|脐带|湿疹|尿布|纸尿裤/u.test(text);
}

function hasCategoryScopeConflict(record: KnowledgeGuardRecord): boolean {
  const category = record.category || '';
  const question = getQuestion(record);

  if (category.startsWith('parenting-') && isPregnancyOrPostpartumContext(question) && !isInfantChildCareContext(question)) {
    return true;
  }

  if (category.startsWith('pregnancy-') && isInfantChildCareContext(question) && !isPregnancyOrPostpartumContext(question)) {
    return true;
  }

  if (/^vaccine-/.test(category) && !/疫苗|接种|打针|预防针|卡介|乙肝疫苗|百白破|麻腮风|脊灰/u.test(question)) {
    return true;
  }

  return false;
}

export function getDatasetKnowledgeDropReason(record: KnowledgeGuardRecord): string | null {
  const question = getQuestion(record);
  if (!question || question.length < 4) {
    return 'empty_or_short_question';
  }

  const text = getRecordText(record);
  if (NON_CONTENT_PATTERN.test(text)) {
    return 'non_content_or_research';
  }

  if (!hasProductScope(question)) {
    return 'missing_product_scope';
  }

  if (BEYOND_CHILD_AGE_PATTERN.test(text)) {
    return 'beyond_app_child_age';
  }

  if (OFF_SCOPE_ADULT_HEALTH_PATTERN.test(text)) {
    return 'off_scope_adult_health';
  }

  const authorityReason = getAuthorityKnowledgeDropReason(record);
  if (authorityReason) {
    return authorityReason === 'death_related_term' || authorityReason === 'high_sensitivity_topic'
      ? 'high_sensitivity_dataset_topic'
      : authorityReason;
  }

  if (HIGH_SENSITIVITY_PATTERN.test(text)) {
    return 'high_sensitivity_dataset_topic';
  }

  if (hasCategoryScopeConflict(record)) {
    return 'category_scope_conflict';
  }

  return null;
}

export function isOutOfScopeKnowledgeQuery(query: string): boolean {
  const normalized = query.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return false;
  }

  return NON_CONTENT_PATTERN.test(normalized)
    || SUPPORT_POLICY_QUERY_PATTERN.test(normalized)
    || BEYOND_CHILD_AGE_PATTERN.test(normalized)
    || OFF_SCOPE_ADULT_HEALTH_PATTERN.test(normalized)
    || HIGH_SENSITIVITY_PATTERN.test(normalized)
    || Boolean(isHighRiskOrClickbaitTitle(normalized))
    || containsDeathRelatedTerms(normalized);
}

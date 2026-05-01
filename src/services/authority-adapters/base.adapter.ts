import type { AuthorityRawDocument, NormalizedAuthorityDocument } from '../authority-sync.service';
import { OFFICIAL_AUTHORITY_SOURCE_IDS, type AuthoritySourceConfig } from '../../config/authority-sources';

export interface AuthorityDocumentAdapter {
  id: string;
  supports(source: AuthoritySourceConfig, raw: AuthorityRawDocument): boolean;
  normalize(source: AuthoritySourceConfig, raw: AuthorityRawDocument): NormalizedAuthorityDocument | null;
}

interface DetectionInput {
  sourceUrl?: string;
  title?: string;
  summary?: string;
  contentText?: string;
}

export interface AuthorityDocumentQualityEvaluation {
  decision: 'pass' | 'reject';
  reasons: string[];
  ocrCandidate: boolean;
}

export function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeAuthorityTitle(input: string): string {
  return stripHtml(input)
    .replace(/^value is what coveo indexes and uses as the title in search results\.?\s*-*>\s*/i, '')
    .replace(/\s*(?:\||-)\s*(?:HealthyChildren\.org|ACOG|WHO|CDC|NHS|Mayo Clinic|NIH)$/i, '')
    .replace(/\s*-\s*HealthyChildren(?:\.org)?$/i, '')
    .replace(/^[-:>\s]+/, '')
    .trim()
    .slice(0, 300);
}

export function extractTitle(rawBody: string): string {
  const candidates = [
    extractMetaContent(rawBody, 'og:title'),
    extractMetaContent(rawBody, 'twitter:title'),
    rawBody.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1],
    rawBody.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const title = sanitizeAuthorityTitle(candidate);
    if (title) {
      return title;
    }
  }

  return 'Untitled authority document';
}

export function extractMetaContent(rawBody: string, name: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = rawBody.match(pattern);
    if (match?.[1]) {
      return stripHtml(match[1]).slice(0, 500);
    }
  }

  return undefined;
}

export function detectRiskLevelDefault(text: string): 'green' | 'yellow' | 'red' {
  if (/大量出血|抽搐|呼吸困难|意识异常|胎动明显减少|破水|seizure|shortness of breath|unresponsive|blue/u.test(text)) {
    return 'red';
  }
  if (/发烧|发热|黄疸|腹泻|呕吐|出血|腹痛|用药|疫苗|fever|diarrhea|vomit|bleeding|vaccine|medication/u.test(text)) {
    return 'yellow';
  }
  return 'green';
}

function normalizeDetectionInput(input: string | DetectionInput): { primary: string; extended: string; sourceUrl: string } {
  if (typeof input === 'string') {
    const normalized = input.toLowerCase();
    return {
      primary: normalized,
      extended: normalized,
      sourceUrl: '',
    };
  }

  const sourceUrl = (input.sourceUrl || '').toLowerCase();
  const title = (input.title || '').toLowerCase();
  const summary = (input.summary || '').toLowerCase();
  const contentText = (input.contentText || '').slice(0, 1600).toLowerCase();
  const primary = [sourceUrl, title, summary].filter(Boolean).join(' ');
  const extended = [primary, contentText].filter(Boolean).join(' ');

  return { primary, extended, sourceUrl };
}

export function detectTopic(input: string | DetectionInput, source: AuthoritySourceConfig): string {
  const { primary, extended, sourceUrl } = normalizeDetectionInput(input);
  const headline = typeof input === 'string'
    ? input.toLowerCase()
    : `${input.sourceUrl || ''} ${input.title || ''}`.toLowerCase();
  const hasExplicitBabySignal = /\/(newborn|baby|infant|neonat)\//.test(sourceUrl)
    || /\/ages-stages\/baby\//.test(sourceUrl)
    || /newborn|neonat|infant|baby|新生儿|婴儿|宝宝/u.test(headline);

  if (/\/(vaccines?|vaccinations?|immunization|immunisation)\//.test(sourceUrl) || /vaccine|vaccin|immuni|接种|疫苗/u.test(primary)) {
    return 'vaccination';
  }

  if (/\/(breastfeed|feeding|formula|nutrition|lactation)\//.test(sourceUrl) || /breastfeed|feeding|喂养|母乳/u.test(primary)) {
    return 'feeding';
  }

  if (/\/(pregnancy|prenatal|postpartum|womens-health|fertility|contraception)\//.test(sourceUrl) || /pregnan|prenatal|postpartum|孕|产后/u.test(primary)) {
    return 'pregnancy';
  }

  if (/政策|规范|通知|解读|意见|方案|决定|纲要|条例|制度|办法/u.test(primary)) {
    return 'policy';
  }

  if (/fontanelle|head shape|flat head|skull|囟门|头型|头围|发育里程碑|growth chart/u.test(extended)) {
    return 'development';
  }

  if (hasExplicitBabySignal) {
    return 'newborn';
  }

  if (/\/(parents?|parenting|toddler|preschool|school|development|developmental-disability|milestone|child-development|ages-stages)\//.test(sourceUrl)
    || /parenting|toddler|preschool|school-age|developmental disabilit|developmental delay|milestone|discipline|behavior|development|child development|learn the signs|act early|autism|adhd|语言发育|里程碑|如厕|学步|学龄前|成长发育|发展迟缓|发育障碍|育儿|自闭/u.test(primary)) {
    return 'development';
  }

  if (/policy|guidance/u.test(primary)) {
    return 'policy';
  }

  if (/fever|diarrhea|symptom|发热|腹泻/u.test(primary)) {
    return 'common-symptoms';
  }

  if (/政策|指南|规范|通知|解读|意见|方案|决定|纲要|条例|制度|办法/u.test(extended)) {
    return 'policy';
  }

  if (/fever|diarrhea|symptom|发热|腹泻/u.test(extended)) {
    return 'common-symptoms';
  }

  return source.topics.length === 1 ? source.topics[0] : 'general';
}

export function detectAudience(input: string | DetectionInput, source: AuthoritySourceConfig): string {
  const { primary, extended, sourceUrl } = normalizeDetectionInput(input);

  if (/\/(toddler|preschool|school|parenting)\//.test(sourceUrl)
    || /toddler|preschool|school-age|potty|discipline|behavior|如厕|学步|学龄前|幼儿/u.test(primary)) {
    return '幼儿家长';
  }

  if (/\/(pregnancy|prenatal|postpartum|womens-health|fertility|contraception)\//.test(sourceUrl) || /pregnan|prenatal|postpartum|孕妇|孕期|怀孕|产后/u.test(primary)) {
    return '孕妇';
  }

  if (/备孕|婚检|孕前/u.test(primary)) {
    return '备孕家庭';
  }

  if (/\/(development|developmental-disability|milestone|child-development|autism|adhd)\//.test(sourceUrl)
    || /developmental disabilit|developmental delay|child development|learn the signs|act early|milestone|autism|adhd|speech delay|language development|成长发育|里程碑|发展迟缓|发育障碍|自闭/u.test(primary)) {
    return '母婴家庭';
  }

  if (/\/(newborn|baby|infant|child|children|ages-stages\/baby)\//.test(sourceUrl)
    || /newborn|infant|baby|child|children|新生儿|婴儿|婴幼儿|儿童|孩子|小儿|育儿|托育/u.test(primary)) {
    return '婴幼儿家长';
  }

  if (/newborn|infant|baby|child|children|新生儿|婴儿|婴幼儿|儿童|孩子|小儿|育儿|托育/u.test(extended)) {
    return '婴幼儿家长';
  }

  if (/pregnan|prenatal|postpartum|孕妇|孕期|产后/u.test(extended)) {
    return '孕妇';
  }

  return source.audience.length === 1 ? source.audience[0] : '母婴家庭';
}

export function isMaternalInfantRelevant(sourceUrl: string, title: string, text: string): boolean {
  const urlTitle = `${sourceUrl} ${title}`.toLowerCase();
  const normalized = `${urlTitle} ${text}`.toLowerCase();

  const strongPositivePatterns = [
    /pregnan|prenatal|antenatal|postpartum|fertility|conceiv|miscarriage|ectopic|labou?r|birth|fetal|foetal/,
    /breast[\s-]?feed|breast milk|formula|wean|feeding/,
    /newborn|neonat|infant|baby|toddler|child|children|paediatric|pediatric/,
    /contracept|iud|coil|implant|family planning/,
    /pregnancy-breastfeeding-and-fertility/,
  ];

  const conditionalPositivePatterns = [
    /(fever|jaundice|vomit|vomiting|diarrhea|diarrhoea|cough|rash|cyanosis).*(baby|child|children|infant|newborn)/,
    /(baby|child|children|infant|newborn).*(fever|jaundice|vomit|vomiting|diarrhea|diarrhoea|cough|rash|cyanosis)/,
    /(vaccin|immuni).*(pregnan|baby|child|children|infant|newborn)/,
    /(pregnan|baby|child|children|infant|newborn).*(vaccin|immuni)/,
    /(孕产妇|孕妇|孕期|孕早期|孕中期|孕晚期|产后|分娩|母乳|哺乳|新生儿|婴儿|儿童|孩子|小儿|儿科|辅食|疫苗|接种|妇幼|生育|托育|备孕|避孕)/,
  ];

  const genericMedicinePattern = /\/medicines\//.test(sourceUrl);
  const medicineSafetyPattern = /pregnancy|breastfeeding|fertility|baby|child|children|infant|newborn/.test(urlTitle);

  const genericVaccinationPattern = /\/vaccinations?\//.test(sourceUrl);
  const childVaccinationPattern = /(pregnan|baby|child|children|infant|newborn)/.test(urlTitle);

  if (strongPositivePatterns.some((pattern) => pattern.test(urlTitle))) {
    return true;
  }

  if (conditionalPositivePatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (genericMedicinePattern && !medicineSafetyPattern) {
    return false;
  }

  if (genericVaccinationPattern && !childVaccinationPattern) {
    return false;
  }

  return false;
}

export function shouldPublishDocument(document: NormalizedAuthorityDocument): 'draft' | 'review' | 'published' | 'rejected' {
  const quality = evaluateAuthorityDocumentQuality(document);
  if (quality.decision === 'reject') {
    return 'rejected';
  }

  const officialSignalText = `${document.title} ${document.summary}`.toLowerCase();
  const isOfficialShortFormGuidance = OFFICIAL_AUTHORITY_SOURCE_IDS.has(document.sourceId)
    && (
      /核心信息|健康提示|科普|提醒|通知|解读|指南|建议|知识要点|宣传|要点|接种日/u.test(officialSignalText)
      || /(免疫|疫苗|接种|儿童|婴幼儿|新生儿|孕妇|孕产|母乳|喂养|营养|辅食|托育|妇幼)/u.test(officialSignalText)
      || /\/t\d{8}_\d+\.(?:html?|shtml)(?:$|[?#])/i.test(document.sourceUrl)
      || /\/common\/content\/content_\d+\.html(?:$|[?#])/i.test(document.sourceUrl)
    );
  const minimumContentLength = OFFICIAL_AUTHORITY_SOURCE_IDS.has(document.sourceId)
    ? (isOfficialShortFormGuidance ? 80 : 150)
    : 300;
  if (!document.contentText || document.contentText.length < minimumContentLength) {
    return 'rejected';
  }

  // Keep emergency content in manual review, but let common maternal/infant
  // symptom, feeding, and vaccination guidance flow into the authority cache.
  if (document.riskLevelDefault === 'red') {
    return 'review';
  }

  return 'published';
}

function containsMostlyChinese(text: string): boolean {
  const chineseChars = text.match(/[\u4e00-\u9fff]/gu)?.length || 0;
  return chineseChars >= 20;
}

function isGenericChineseNavigationTitle(title: string): boolean {
  return /^(首页|网站首页|新闻中心|图片新闻|文字新闻|技术规范|工作指南|监测结果|通讯专栏|继续教育|基层交流|共享资源|调查问卷|关于我们|联系我们|国际合作|期刊杂志|工作动态|科普知识|政策文件|科研成果|科研动态|项目申报|学习园地|中心党建|地方经验|通知公告|行业动态|科普宣传|中国居民膳食指南|中国妇幼健康监测|正在建设中……?)$/u.test(title.trim());
}

const GOVCN_OFFTOPIC_SOURCE_IDS = new Set(['govcn-muying', 'govcn-jiedu-muying']);

const GOVCN_MATERNAL_FOCUS_PATTERN = /婴幼儿|新生儿|孕产|母乳|哺乳|出生缺陷|危重孕产妇|生育友好|育儿补贴|学前教育|普惠托育|婴配|HPV|疫苗免疫|预防接种证|入托|入学预防接种|儿童青少年.{0,4}近视|儿童青少年.{0,4}健康|儿童青少年.{0,4}五健|儿童医疗|儿科/u;

const GOVCN_CONSUMER_TOPIC_PATTERN = /餐饮|住宿|文旅|家政|消费贷|个人消费|个税|社保|增收|就业|两新|消费品以旧换新|对外贸易|对外出口|资源下沉|提振消费|服务消费/u;

const GOVCN_DRUG_CATALOG_PATTERN = /国家(?:基本医疗保险|医保)?[^，。！？]*药品目录|药品目录调整/u;

const GOVCN_VACCINE_EXPORT_PATTERN = /对外出口|外贸/u;

const GOVCN_DISABLED_EDUCATION_PATTERN = /(残疾(?:儿童|少年)|特殊教育|特教).{0,20}(义务教育|入学率|随班就读|提升|计划|普及)/u;

const GOVCN_ELDER_MIXED_PATTERN = /养老.{0,8}托育|养老.{0,4}育幼|养老托育|养老.{0,8}家政|养老.{0,8}文旅/u;

const GOVCN_BROAD_CHILD_POLICY_PATTERN = /儿童青少年|青少年|中小学生|学校卫生|学前教育|幼儿园|大班儿童|学籍|入学|儿童友好(?:建设|医院)?|儿童福利|困境儿童|监护缺失儿童|残疾儿童|特殊教育|儿童医疗卫生服务|儿童药品|儿童参加基本医疗保险|儿童青少年近视|近视防控|五健|孤独症|眼保健|收养评估|妇女儿童发展纲要|儿童发展纲要|十五五|生育休假制度|生育支持政策体系|优化生育政策工作|联席会议|三孩生育政策|价格形成机制|示范城市|民用机场母婴室|消防安全|生育登记/u;

const GOVCN_MIXED_CONSUMER_PATTERN = /个人消费贷|购车指标|餐饮住宿|文旅|社保|两新|消费品以旧换新/u;

const GOVCN_STRONG_PRODUCT_SCOPE_PATTERN = /3岁以下|三岁以下|0[~～-]3岁|0到3岁|婴幼儿|婴儿|新生儿|孕产|孕妇|孕期|备孕|产后|分娩|产科|生育友好|生育支持|托育|育儿补贴制度|母乳|哺乳|喂养|辅食|配方乳粉|百白破/u;

const GOVCN_HEALTH_GUIDANCE_PATTERN = /婴幼儿营养喂养评估|婴幼儿早期发展服务指南|3岁以下婴幼儿健康养育照护指南|婴幼儿配方乳粉|百白破|白破疫苗|免疫程序|危重孕产妇救治|孕产妇疾病救治|安全助产|儿童和孕产妇.{0,20}疫情防控|生育友好医院/u;

const GOVCN_SUPPORT_OR_BENEFIT_POLICY_PATTERN = /育儿补贴|补贴制度|申领|支付宝|微信|中央财政|预算|托育服务|普惠托育|生育保险|大病保险|落地即参保|医保局|产科服务价格|医疗服务价格|个税|个人所得税|专项附加扣除|减税|红包|积极生育支持|生育支持政策|实施方案/u;

// Title- and content-level guards for high-sensitivity, sensational, and
// pseudo-medical content. These are checked in three places: the quality gate
// (evaluateAuthorityDocumentQuality), the adapter pipeline
// (normalizeWithAuthorityAdapter — drops the document before persistence so it
// is never crawled into the cache), and offline cleanup scripts
// (reject-authority-navigation-documents.ts, clean-authority-cache-file.ts).
//
// Death-related terms are removed unconditionally per product requirement —
// even statistical references like "孕产妇死亡率" are excluded so the
// authority knowledge base stays free of bereavement-adjacent vocabulary.
const DEATH_RELATED_ZH_PATTERN = /死亡|死产|胎死|胎停|稽留流产|致死|猝死|身亡|溺亡|窒息死|遗体|讣告|殉职|殉难|哀悼|遇难|罹难|逝世|去世|过世|病故|早夭|夭折|死胎|尸检|尸体|要命/u;

const DEATH_RELATED_EN_PATTERN = /\b(?:deaths?|died|dying|deceased|fatal|fatality|fatalities|stillbirths?|stillborn|mortality|demise|perinatal\s+mortality|neonatal\s+deaths?|infant\s+deaths?|sudden\s+infant\s+death|sids|miscarriages?|stillbirth)\b/i;

export function containsDeathRelatedTerms(text: string): boolean {
  if (!text) {
    return false;
  }
  return DEATH_RELATED_ZH_PATTERN.test(text) || DEATH_RELATED_EN_PATTERN.test(text);
}

const HIGH_SENSITIVITY_TOPIC_PATTERN = /胎死(?:腹中|宫内)?|胎停(?:育)?|稽留流产|胎儿宫内死亡|胎儿畸形(?:引产|终止妊娠)|引产案例|引产经历|堕胎(?:经历|过程|手术)|遗腹子/u;

const SENSATIONAL_LANGUAGE_PATTERN = /(?:很要命|后患无穷|致命|可怕|惊人|惊悚|惊呆|噩耗|崩溃|惨剧|惨痛|血淋淋|绝症|悲剧|越来越多|不敢相信|高度警惕|都怪|这件事能|赶紧拿|赶紧用|分分钟|惊天|揪心|哭了|崩溃了|无人不知|无人不晓|惊曝|曝光|警惕!|当心!|千万别|太可怕|必看|秒懂|不妨试试|绝招|招数|支招|智力受损|补脑|不防不行|妈妈要早知|值得家长一看)/u;

const PSEUDO_MEDICAL_GENDER_SELECTION_PATTERN = /(?:备孕|怀孕|二胎|三胎|想要|要想|准备)[^，。！？]{0,8}(?:男孩|女孩|男宝|女宝|男娃|女娃|儿子)(?![名个])|(?:生|怀|要)(?:个)?(?:男孩|女孩|男宝|女宝|男娃|女娃)(?:[^，。！？]{0,12}(?:秘诀|偏方|方法|妙招|妙方|技巧|吃什么|怎么吃|食谱|配方|攻略|科学|备孕|攻略|攻略)|$|？|\?)|(?:男孩|女孩|男宝|女宝)[^，。！？]{0,6}(?:秘诀|偏方|妙方)|生男生女(?:秘诀|预测|看|早知道|提前知道)|清宫(?:表|图)预测|(?:酸性体质|碱性体质)[^，。！？]{0,8}(?:生男|生女|男孩|女孩)/u;

const PSEUDO_MEDICAL_QUACK_PATTERN = /(?:转骨|穿胎|安胎药偏方)|快速.{0,4}(?:根治|痊愈|康复)|根治.{0,4}(?:湿疹|肾病|白血病|脑瘫)|包治|祖传秘方|神奇.{0,4}(?:配方|方法|偏方)/u;

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

export function isOffTopicGovPolicyTitle(title: string, sourceId: string): string | null {
  if (!GOVCN_OFFTOPIC_SOURCE_IDS.has(sourceId)) {
    return null;
  }

  const normalized = (title || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  if (!normalized.trim()) {
    return null;
  }

  if (GOVCN_DRUG_CATALOG_PATTERN.test(normalized)) {
    return 'govcn_drug_catalog';
  }

  if (GOVCN_VACCINE_EXPORT_PATTERN.test(normalized)) {
    return 'govcn_export_policy';
  }

  if (GOVCN_DISABLED_EDUCATION_PATTERN.test(normalized)) {
    return 'govcn_special_education';
  }

  const hasMaternalFocus = GOVCN_MATERNAL_FOCUS_PATTERN.test(normalized);

  if (GOVCN_ELDER_MIXED_PATTERN.test(normalized) && !hasMaternalFocus) {
    return 'govcn_elder_care_mixed';
  }

  if (GOVCN_SUPPORT_OR_BENEFIT_POLICY_PATTERN.test(normalized) && !GOVCN_HEALTH_GUIDANCE_PATTERN.test(normalized)) {
    return 'govcn_non_health_policy';
  }

  if (/(十五五|生育休假制度|生育支持政策体系|优化生育政策工作|联席会议|三孩生育政策|价格形成机制|示范城市|民用机场母婴室|消防安全|生育登记)/u.test(normalized)
    && !/(育儿补贴制度|3岁以下|三岁以下|0[~～-]3岁|0到3岁|婴幼儿[^，。！？]{0,12}指南|百白破|生育保险|新生儿[^，。！？]{0,8}参保)/u.test(normalized)) {
    return 'govcn_broad_policy';
  }

  if (GOVCN_MIXED_CONSUMER_PATTERN.test(normalized)
    && !/(3岁以下|三岁以下|0[~～-]3岁|0到3岁|婴幼儿照护|生育保险)/u.test(normalized)) {
    return 'govcn_multi_topic_policy';
  }

  if (GOVCN_CONSUMER_TOPIC_PATTERN.test(normalized) && !hasMaternalFocus) {
    return 'govcn_multi_topic_policy';
  }

  if (GOVCN_BROAD_CHILD_POLICY_PATTERN.test(normalized) && !GOVCN_STRONG_PRODUCT_SCOPE_PATTERN.test(normalized)) {
    return 'govcn_broad_child_policy';
  }

  return null;
}

function isLikelyNavigationText(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  if (!compact) {
    return false;
  }

  const navSignals = (compact.match(/(首页|新闻中心|联系我们|关于我们|搜索|版权所有|备案|网站地图|技术支持|栏目|更多|上一页|下一页|友情链接|当前位置|请输入关键字)/gu) || []).length;
  const topicSignals = (compact.match(/(孕产|孕妇|孕期|产后|儿童|婴幼儿|新生儿|母乳|喂养|辅食|营养|膳食|疫苗|出生缺陷|托育|体重管理|发育|接种|黄疸|发热|腹泻)/gu) || []).length;
  const contentSignals = (compact.match(/(建议|应当|需要|可以|避免|注意|指导|监测|评估|风险|管理|预防|治疗|就医|接种|摄入|喂养)/gu) || []).length;

  return navSignals >= 6 && topicSignals <= 3 && contentSignals <= 3;
}

export function isLikelyEnglishNavigationShell(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return false;
  }

  const lower = normalized.toLowerCase();
  const navPatterns = [
    /turn on more accessible mode/,
    /skip ribbon commands/,
    /skip to main content/,
    /our sponsors/,
    /log in\s*\|\s*register/,
    /donate menu/,
    /find a pediatrician/,
    /ages\s*&\s*stages/,
    /healthy living/,
    /safety\s*&\s*prevention/,
    /family life/,
    /health issues/,
    /tips\s*&\s*tools/,
    /our mission/,
    /healthy children\s*>/,
    /page content/,
  ];
  const navSignals = navPatterns.reduce((total, pattern) => total + (pattern.test(lower) ? 1 : 0), 0);
  const pageContentIndex = lower.lastIndexOf('page content');
  const afterPageContent = pageContentIndex >= 0
    ? normalized.slice(pageContentIndex + 'page content'.length).trim()
    : '';
  const pageContentNearEnd = pageContentIndex >= 0 && pageContentIndex >= lower.length - 260;

  return navSignals >= 8 && (pageContentNearEnd || afterPageContent.length < 180);
}

function hasOcrOnlyDocumentSignal(document: NormalizedAuthorityDocument): boolean {
  const text = `${document.title} ${document.summary} ${document.sourceUrl}`.toLowerCase();
  const metadata = document.metadataJson || {};
  const imageCount = typeof metadata.imageCount === 'number' ? metadata.imageCount : 0;
  const pdfSignal = /\.pdf(?:$|[?#])/i.test(document.sourceUrl) || /pdf|扫描|图示|图片|长图|海报|核心信息/u.test(text);
  return imageCount > 0 || pdfSignal;
}

export function evaluateAuthorityDocumentQuality(document: NormalizedAuthorityDocument): AuthorityDocumentQualityEvaluation {
  const reasons: string[] = [];
  const title = document.title.trim();
  const contentText = document.contentText || '';
  const isChinese = document.sourceLanguage === 'zh'
    || document.sourceLocale === 'zh-CN'
    || document.region === 'CN'
    || containsMostlyChinese(`${title} ${document.summary} ${contentText.slice(0, 600)}`);

  if (!title || /^untitled authority document$/i.test(title)) {
    reasons.push('missing_title');
  }

  if (isChinese && isGenericChineseNavigationTitle(title)) {
    reasons.push('generic_chinese_navigation_title');
  }

  if (isChinese && isLikelyNavigationText(contentText)) {
    reasons.push('navigation_dense_content');
  }

  if (!isChinese && isLikelyEnglishNavigationShell(`${document.summary || ''} ${contentText}`)) {
    reasons.push('english_navigation_shell');
  }

  if (isChinese && /(?:电话|地址|邮箱|传真|版权所有|备案|技术支持|联系我们).{0,80}(?:电话|地址|邮箱|传真|版权所有|备案|技术支持|联系我们)/u.test(contentText)
    && !/(孕产|孕妇|孕期|产后|儿童|婴幼儿|新生儿|母乳|喂养|辅食|营养|膳食|疫苗|出生缺陷|托育|体重管理|发育)/u.test(`${title} ${document.summary}`)) {
    reasons.push('contact_or_footer_content');
  }

  const govPolicyReason = isOffTopicGovPolicyTitle(title, document.sourceId);
  if (govPolicyReason) {
    reasons.push(govPolicyReason);
  }

  const sensitivityReason = isHighRiskOrClickbaitTitle(title);
  if (sensitivityReason) {
    reasons.push(sensitivityReason);
  }

  if (containsDeathRelatedTerms(`${document.summary || ''} ${contentText}`)) {
    reasons.push('death_related_term');
  }

  const ocrCandidate = hasOcrOnlyDocumentSignal(document);
  return {
    decision: reasons.length > 0 ? 'reject' : 'pass',
    reasons,
    ocrCandidate,
  };
}

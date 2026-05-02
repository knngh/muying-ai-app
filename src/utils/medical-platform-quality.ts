export interface MedicalPlatformQualityRecord {
  title?: string;
  summary?: string;
  answer?: string;
  contentText?: string;
  sourceId?: string;
  sourceOrg?: string;
  source?: string;
  sourceClass?: string;
  sourceUrl?: string;
  updatedAt?: string;
}

const MEDICAL_PLATFORM_SOURCE_PATTERN = /dxy-maternal|chunyu-maternal|youlai-pregnancy-guide|dayi-maternal-child|kepuchina-maternal-child|haodf-maternal-child|familydoctor-maternal|yilianmeiti-maternal-child|丁香医生|春雨医生|有来医生|中国医药信息查询平台|科普中国|好大夫在线|家庭医生在线|医联媒体|dxy\.com|chunyuyisheng\.com|youlai\.cn|dayi\.org\.cn|kepuchina\.cn|haodf\.com|familydoctor\.com\.cn|yilianmeiti\.com/u;

const DISABLED_AUTOMATIC_MEDICAL_PLATFORM_SOURCE_PATTERN = /dxy-maternal|chunyu-maternal|familydoctor-maternal|yilianmeiti-maternal-child|丁香医生|春雨医生|家庭医生在线|医联媒体|dxy\.com|chunyuyisheng\.com|familydoctor\.com\.cn|yilianmeiti\.com/u;

const NOISY_MEDICAL_PLATFORM_TITLE_PATTERN = /(?:合集|科普文章合集|小心|必看|千万|赶紧|速看|速览|揭秘|真相|别慌|怎么破|要知道|这类[^，。！？]{0,8}特别注意|秘籍|攻略|宝典|一文(?:读懂|看懂|了解)|看这一篇|新妈|新手妈妈们?|宝妈必看|妈妈必看|医院哪家|排行|排名|口碑|即时公开|今日公开|医师速览)/u;

const CASUAL_OR_PROMOTIONAL_TEXT_PATTERN = /(?:小编|今天咱|咱就|唠唠|别着急|犯起了嘀咕|心里犯嘀咕|小捣蛋|宝妈们?|妈咪|妙招|绝招|支招|偏方|赶紧|免费咨询|预约挂号|在线问诊|医院哪家|排行榜|排行说明|口碑|即时公开|今日公开|医师速览)/u;

const SEVERE_CASE_NEWS_PATTERN = /(?:恶性肿瘤|癌症|白血病|脑瘫|罕见病|不治之症|保生育|拆弹|病例|患儿|住院|手术切除|多学科协作|MDT|专家[：:]|掌心宝宝|生命奇迹|闯关出院|医护托起|精准救治|重重生命关卡)/u;

const DAYI_CASUAL_OR_PROMOTIONAL_TEXT_PATTERN = /(?:小编|今天咱|咱就|唠唠|别着急|犯起了嘀咕|心里犯嘀咕|小捣蛋|宝妈们?|妈咪|妙招|绝招|支招|偏方|赶紧|免费咨询|在线问诊|医院哪家|排行榜|排行说明|口碑|即时公开|今日公开|医师速览)/u;

const DAYI_SEVERE_CASE_NEWS_PATTERN = /(?:恶性肿瘤|癌症|白血病|脑瘫|罕见病|不治之症|保生育|拆弹|病例|患儿|手术切除|多学科协作|MDT|专家[：:])/u;

const KEPUCHINA_CASUAL_OR_PROMOTIONAL_TEXT_PATTERN = /(?:朋友圈|晒娃|吐槽|微信聊天|初为人母|同部门|同事|新手妈妈[^，。！？]{0,12}(?:吐槽|朋友圈))/u;

const KEPUCHINA_SEVERE_CASE_NEWS_PATTERN = /(?:恶性肿瘤|癌症|白血病|脑瘫|罕见病|不治之症|保生育|拆弹|病例|手术切除|多学科协作|MDT)/u;

const KEPUCHINA_NON_GUIDANCE_TITLE_PATTERN = /(?:科普团队|典赞|获奖|风采|活动回顾|会议|启动仪式|招募|征集|通知公告|共建生育友好)/u;

const HAODF_REPOST_OR_FORUM_PATTERN = /(?:转载自|转自|转发|论坛|患友会|病例|问诊记录|图文问诊|电话问诊|公益图文问诊)/u;

const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function getRecordText(record: MedicalPlatformQualityRecord): string {
  return [
    record.title,
    record.summary,
    record.answer,
    record.contentText,
  ].filter(Boolean).join(' ');
}

function getRecordSourceText(record: MedicalPlatformQualityRecord): string {
  return [
    record.sourceId,
    record.sourceOrg,
    record.source,
    record.sourceUrl,
  ].filter(Boolean).join(' ');
}

export function isMedicalPlatformRecord(record: MedicalPlatformQualityRecord): boolean {
  return record.sourceClass === 'medical_platform'
    || MEDICAL_PLATFORM_SOURCE_PATTERN.test(getRecordSourceText(record));
}

function getPublishedYear(value?: string): number | null {
  if (!value) {
    return null;
  }

  const year = value.match(/\b(20\d{2})\b/u)?.[1];
  if (!year) {
    return null;
  }

  const parsed = Number(year);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getMedicalPlatformQualityDropReason(record: MedicalPlatformQualityRecord): string | null {
  if (!isMedicalPlatformRecord(record)) {
    return null;
  }

  const title = (record.title || '').trim();
  const text = getRecordText(record);
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const sourceText = getRecordSourceText(record);
  const isDayi = /dayi-maternal-child|中国医药信息查询平台|dayi\.org\.cn/u.test(sourceText);
  const isKepuchina = /kepuchina-maternal-child|科普中国|kepuchina\.cn/u.test(sourceText);
  const isHaodf = /haodf-maternal-child|好大夫在线|haodf\.com/u.test(sourceText);
  const isDisabledAutomaticSource = DISABLED_AUTOMATIC_MEDICAL_PLATFORM_SOURCE_PATTERN.test(sourceText);

  if (!title) {
    return 'medical_platform_missing_title';
  }

  if (normalizedText.length < 320) {
    return 'medical_platform_short_content';
  }

  if (NOISY_MEDICAL_PLATFORM_TITLE_PATTERN.test(title)) {
    return 'medical_platform_noisy_title';
  }

  if (isKepuchina && KEPUCHINA_NON_GUIDANCE_TITLE_PATTERN.test(title)) {
    return 'medical_platform_noisy_title';
  }

  const severeCasePattern = isKepuchina
    ? KEPUCHINA_SEVERE_CASE_NEWS_PATTERN
    : (isDayi ? DAYI_SEVERE_CASE_NEWS_PATTERN : SEVERE_CASE_NEWS_PATTERN);
  if (severeCasePattern.test(`${title} ${normalizedText}`)) {
    return 'medical_platform_severe_case_news';
  }

  if (EMOJI_PATTERN.test(normalizedText)) {
    return 'medical_platform_emoji_or_social_style';
  }

  if (isKepuchina && KEPUCHINA_CASUAL_OR_PROMOTIONAL_TEXT_PATTERN.test(normalizedText)) {
    return 'medical_platform_casual_or_promotional';
  }

  const casualOrPromotionalPattern = isDayi ? DAYI_CASUAL_OR_PROMOTIONAL_TEXT_PATTERN : CASUAL_OR_PROMOTIONAL_TEXT_PATTERN;
  if (casualOrPromotionalPattern.test(normalizedText)) {
    return 'medical_platform_casual_or_promotional';
  }

  const publishedYear = getPublishedYear(record.updatedAt);
  if (publishedYear !== null && publishedYear < 2021) {
    return 'medical_platform_stale_content';
  }

  if (/familydoctor-maternal|家庭医生在线|familydoctor\.com\.cn/u.test(sourceText)
    && !/(主任医师|副主任医师|主治医师|医师|医生|审稿|审核|专家|医院|儿科|妇产科)/u.test(normalizedText)) {
    return 'medical_platform_missing_professional_signal';
  }

  if (isHaodf && HAODF_REPOST_OR_FORUM_PATTERN.test(`${title} ${normalizedText}`)) {
    return 'medical_platform_repost_or_forum_content';
  }

  if (isHaodf
    && !/(实名认证|医生本人发表|主任医师|副主任医师|主治医师|妇幼保健院|儿童医院|[一-龥]{2,30}医院.{0,12}(?:妇产科|产科|儿科|新生儿科)|(?:妇产科|产科|儿科|新生儿科).{0,12}[一-龥]{2,30}医院)/u.test(normalizedText)) {
    return 'medical_platform_missing_professional_signal';
  }

  if (isDisabledAutomaticSource) {
    return 'medical_platform_disabled_source';
  }

  return null;
}

export function isHighQualityMedicalPlatformRecord(record: MedicalPlatformQualityRecord): boolean {
  return isMedicalPlatformRecord(record) && !getMedicalPlatformQualityDropReason(record);
}

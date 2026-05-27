const OFFICIAL_CHINESE_GUIDANCE_SOURCE_IDS = new Set([
  'ncwch-maternal-child-health',
  'mchscn-monitoring',
  'cnsoc-dietary-guidelines',
  'chinanutri-maternal-child',
]);

const OFFICIAL_ACTIVITY_OR_ADMIN_PATTERN = /(?:培训(?:班|会|会议|活动|项目|通知)?|会议|研讨会|论坛|座谈会|交流会|启动(?:式|会)|宣传倡导活动|主题活动|工作动态|新闻动态|图片新闻|文字新闻|通知公告|公告|公示|征集|招聘|遴选|名单|获奖|表彰|继续教育|基层交流|通讯|党建|工会|妇女节|举办|召开|承办)/u;
const OFFICIAL_NAVIGATION_BODY_PATTERN = /(?:检测到您正在使用IE8以下内核的浏览器|谷歌浏览器推荐下载地址|QQ浏览器|宣传和培训.{0,120}联系我们地址|>\s*新闻中心\s*>|联系我们地址：|电话：.{0,40}传真：|E-mail：)/u;
const MCHSCN_ADMIN_FORM_PATTERN = /(?:表卡|项目数|功能调整|系统|标注|填报|登记卡|调查表|监测表)/u;
const CHINANUTRI_NEWS_OR_ACTIVITY_PATTERN = /(?:全民营养周|主场活动|启动仪式|营养健康热潮|新闻中心|地方动态与行业新闻|在北京举行|近日，|发布公告)/u;
const NCWCH_ADMIN_NEWS_PATTERN = /(?:调研|赴.{0,20}开展|座谈|参观|来访|交流)/u;
const CNSOC_RELEASE_NEWS_PATTERN = /(?:在京发布|发布会|六一国际儿童节之际)/u;
const CORE_GUIDANCE_TITLE_PATTERN = /(?:核心信息|核心推荐|指南|指导原则|健康提示|喂养|膳食|孕妇|乳母|婴幼儿|儿童营养)/u;

export interface OfficialChineseAuthorityQualityRecord {
  sourceId?: string | null;
  source_id?: string | null;
  sourceOrg?: string | null;
  source_org?: string | null;
  source?: string | null;
  title?: string | null;
  question?: string | null;
  summary?: string | null;
  answer?: string | null;
  content?: string | null;
  contentText?: string | null;
}

function normalizeSourceId(record: OfficialChineseAuthorityQualityRecord): string {
  return (record.sourceId || record.source_id || '').trim();
}

function normalizeText(value: string | null | undefined): string {
  return (value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getOfficialChineseAuthorityQualityDropReason(
  record: OfficialChineseAuthorityQualityRecord,
): string | null {
  const sourceId = normalizeSourceId(record);
  if (!OFFICIAL_CHINESE_GUIDANCE_SOURCE_IDS.has(sourceId)) {
    return null;
  }

  const title = normalizeText(record.title || record.question);
  const summary = normalizeText(record.summary);
  const body = normalizeText(record.contentText || record.answer || record.content);
  const signalText = `${title} ${summary}`.trim();
  if (!signalText) {
    return null;
  }

  if (OFFICIAL_NAVIGATION_BODY_PATTERN.test(body)) {
    return 'official_chinese_navigation_shell';
  }

  if (sourceId === 'mchscn-monitoring' && MCHSCN_ADMIN_FORM_PATTERN.test(signalText)) {
    return 'official_chinese_admin_or_form_page';
  }

  if (sourceId === 'chinanutri-maternal-child' && CHINANUTRI_NEWS_OR_ACTIVITY_PATTERN.test(`${signalText} ${body.slice(0, 200)}`)) {
    return 'official_chinese_activity_or_admin';
  }

  if (sourceId === 'ncwch-maternal-child-health' && NCWCH_ADMIN_NEWS_PATTERN.test(signalText)) {
    return 'official_chinese_activity_or_admin';
  }

  if (sourceId === 'cnsoc-dietary-guidelines'
    && CNSOC_RELEASE_NEWS_PATTERN.test(signalText)
    && !CORE_GUIDANCE_TITLE_PATTERN.test(signalText)) {
    return 'official_chinese_activity_or_admin';
  }

  if (OFFICIAL_ACTIVITY_OR_ADMIN_PATTERN.test(signalText)) {
    return 'official_chinese_activity_or_admin';
  }

  return null;
}

const OFFICIAL_CHINESE_GUIDANCE_SOURCE_IDS = new Set([
  'nhc-fys',
  'nhc-rkjt',
  'chinacdc-immunization',
  'chinacdc-nutrition',
  'ndcpa-immunization',
  'ndcpa-public-health',
  'ncwch-maternal-child-health',
  'mchscn-monitoring',
  'cnsoc-dietary-guidelines',
  'chinanutri-maternal-child',
]);

const OFFICIAL_ACTIVITY_OR_ADMIN_PATTERN = /(?:培训(?:班|会|会议|活动|项目|通知)?|会议|工作会|工作会议|推进会|现场会|电视电话会议|视频会议|宣传日|宣传周|宣传月|主题宣传|宣贯|研讨会|论坛|座谈会|交流会|经验交流|启动(?:式|会)?|宣传海报|宣传活动|宣传倡导活动|主题活动|活动|工作动态|新闻动态|图片新闻|文字新闻|通知公告|公告|通知|公示|初审|复审|征集|招聘|遴选|名单|获奖|表彰|继续教育|基层交流|通讯|党建|工会|妇女节|职业技能(?:竞赛|大赛)|技能(?:竞赛|大赛)|同台竞技|举办|召开|承办|发布|印发|部署|动员|开幕|成立|签约|调研|走进|函〔\d{4}〕\d+号|^附件[:：])/u;
const OFFICIAL_NAVIGATION_BODY_PATTERN = /(?:检测到您正在使用IE8以下内核的浏览器|谷歌浏览器推荐下载地址|QQ浏览器|宣传和培训.{0,120}联系我们地址|>\s*新闻中心\s*>|联系我们地址：|电话：.{0,40}传真：|E-mail：)/u;
const OFFICIAL_NAVIGATION_TITLE_PATTERN = /^(?:中国疾病预防控制中心|国家疾病预防控制局|国家卫生健康委员会|国家卫生健康委员会.+司|首页|新闻中心|工作动态|通知公告)$/u;
const MCHSCN_ADMIN_FORM_PATTERN = /(?:表卡|项目数|功能调整|系统|标注|填报|登记卡|调查表|监测表)/u;
const CHINANUTRI_NEWS_OR_ACTIVITY_PATTERN = /(?:全民营养周|主场活动|启动仪式|营养健康热潮|新闻中心|地方动态与行业新闻|在北京举行|近日，|发布公告)/u;
const NCWCH_ADMIN_NEWS_PATTERN = /(?:调研|赴.{0,20}开展|座谈|参观|来访|交流)/u;
const CNSOC_RELEASE_NEWS_PATTERN = /(?:在京发布|发布会|六一国际儿童节之际)/u;
const CORE_GUIDANCE_TITLE_PATTERN = /(?:核心信息|核心推荐|关键信息|常见问题|指南|指导原则|健康提示|喂养评估|喂养指南|膳食指南|孕妇.{0,8}指南|乳母.{0,8}指南|儿童营养|免疫程序|接种程序|疫苗儿童免疫|配方乳粉)/u;
const OFFICIAL_LOW_VALUE_POLICY_PATTERN = /(?:育儿补贴|补贴制度|政策问答|个人所得税|专项附加扣除|医保|生育保险|申领|财政|预算)/u;
const OFFICIAL_OFFTOPIC_NUTRITION_CULTURE_PATTERN = /(?:民谚|年关|磨豆腐|兜福|都富|家宅兴旺|福气满满)/u;
const OFFICIAL_BROAD_CHILD_POLICY_PATTERN = /(?:儿童青少年|青少年|五健|儿童友好医院|儿童医疗卫生服务|儿童药品|妇女儿童发展纲要|儿童发展纲要)/u;
const OFFICIAL_BODY_EXCERPT_TITLE_PATTERN = /^(?:为贯彻|为有效|近日[，,]|寒风凛冽|你知道吗[？?]|疫苗是预防|“?\s*二十五|[一二三四五六七八九十]、)/u;
const OFFICIAL_CHINACDC_NUTRITION_GENERAL_PATTERN = /(?:学龄儿童|6\s*[~～-]\s*17\s*岁|全家饮食|清明时节|素食人群|畜肉|家禽|海鲜|节气|冬日清晨|早餐)/u;

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

  if (OFFICIAL_NAVIGATION_TITLE_PATTERN.test(title)) {
    return 'official_chinese_navigation_shell';
  }

  if (sourceId === 'chinacdc-nutrition'
    && OFFICIAL_OFFTOPIC_NUTRITION_CULTURE_PATTERN.test(`${signalText} ${body.slice(0, 200)}`)) {
    return 'official_chinese_activity_or_admin';
  }

  if (sourceId === 'chinacdc-nutrition'
    && OFFICIAL_CHINACDC_NUTRITION_GENERAL_PATTERN.test(`${signalText} ${body.slice(0, 200)}`)
    && !CORE_GUIDANCE_TITLE_PATTERN.test(signalText)) {
    return 'official_chinese_activity_or_admin';
  }

  if (OFFICIAL_BROAD_CHILD_POLICY_PATTERN.test(signalText) && !CORE_GUIDANCE_TITLE_PATTERN.test(signalText)) {
    return 'official_chinese_activity_or_admin';
  }

  if (OFFICIAL_LOW_VALUE_POLICY_PATTERN.test(signalText) && !CORE_GUIDANCE_TITLE_PATTERN.test(signalText)) {
    return 'official_chinese_activity_or_admin';
  }

  if (title.length > 70 && OFFICIAL_BODY_EXCERPT_TITLE_PATTERN.test(title) && !CORE_GUIDANCE_TITLE_PATTERN.test(signalText)) {
    return 'official_chinese_activity_or_admin';
  }

  if (title.length > 90 && /[，。；]/u.test(title) && !CORE_GUIDANCE_TITLE_PATTERN.test(signalText)) {
    return 'official_chinese_activity_or_admin';
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

  if (OFFICIAL_ACTIVITY_OR_ADMIN_PATTERN.test(signalText) && !CORE_GUIDANCE_TITLE_PATTERN.test(signalText)) {
    return 'official_chinese_activity_or_admin';
  }

  return null;
}

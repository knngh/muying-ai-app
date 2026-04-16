export type AuthorityDiscoveryType = 'rss' | 'sitemap' | 'api' | 'index_page' | 'pdf_index';

export interface AuthoritySourceConfig {
  id: string;
  org: string;
  baseUrl: string;
  allowedDomains: string[];
  discoveryType: AuthorityDiscoveryType;
  entryUrls: string[];
  region: 'US' | 'UK' | 'CN' | 'GLOBAL';
  language: 'zh' | 'en';
  locale: string;
  audience: string[];
  topics: string[];
  enabled: boolean;
  fetchIntervalMinutes: number;
  maxPagesPerRun: number;
  maxDiscoveryIndexPages?: number;
  parserId: string;
}

export const AUTHORITY_SOURCES: AuthoritySourceConfig[] = [
  {
    id: 'who',
    org: 'WHO',
    baseUrl: 'https://www.who.int',
    allowedDomains: ['who.int'],
    discoveryType: 'sitemap',
    entryUrls: [
      'https://www.who.int/sitemaps/sitemapindex.xml',
    ],
    region: 'GLOBAL',
    language: 'en',
    locale: 'en',
    audience: ['孕妇', '新生儿家长', '婴幼儿家长'],
    topics: ['pregnancy', 'newborn', 'feeding', 'vaccination', 'common-symptoms'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 300,
    parserId: 'who',
  },
  {
    id: 'cdc',
    org: 'CDC',
    baseUrl: 'https://www.cdc.gov',
    allowedDomains: ['cdc.gov'],
    discoveryType: 'sitemap',
    entryUrls: [
      'https://www.cdc.gov/wcms-auto-sitemap-index.xml',
    ],
    region: 'US',
    language: 'en',
    locale: 'en-US',
    audience: ['孕妇', '新生儿家长', '婴幼儿家长'],
    topics: ['pregnancy', 'newborn', 'feeding', 'vaccination', 'common-symptoms'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 300,
    parserId: 'cdc',
  },
  {
    id: 'aap',
    org: 'AAP',
    baseUrl: 'https://www.healthychildren.org',
    allowedDomains: ['healthychildren.org'],
    discoveryType: 'sitemap',
    entryUrls: [
      'https://www.healthychildren.org/sitemap.xml',
    ],
    region: 'US',
    language: 'en',
    locale: 'en-US',
    audience: ['新生儿家长', '婴幼儿家长', '母婴家庭'],
    topics: ['newborn', 'feeding', 'vaccination', 'common-symptoms', 'development'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 300,
    parserId: 'aap',
  },
  {
    id: 'acog',
    org: 'ACOG',
    baseUrl: 'https://www.acog.org',
    allowedDomains: ['acog.org'],
    discoveryType: 'sitemap',
    entryUrls: [
      'https://www.acog.org/sitemap.xml',
    ],
    region: 'US',
    language: 'en',
    locale: 'en-US',
    audience: ['孕妇', '产后妈妈', '备孕女性'],
    topics: ['pregnancy', 'postpartum', 'feeding', 'common-symptoms'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 300,
    parserId: 'acog',
  },
  {
    id: 'nhs',
    org: 'NHS',
    baseUrl: 'https://www.nhs.uk',
    allowedDomains: ['nhs.uk'],
    discoveryType: 'sitemap',
    entryUrls: [
      'https://www.nhs.uk/sitemap.xml',
    ],
    region: 'UK',
    language: 'en',
    locale: 'en-GB',
    audience: ['孕妇', '新生儿家长', '婴幼儿家长'],
    topics: ['pregnancy', 'newborn', 'feeding', 'vaccination', 'common-symptoms'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 300,
    parserId: 'nhs',
  },
  {
    id: 'mayo-clinic-zh',
    org: 'Mayo Clinic',
    baseUrl: 'https://www.mayoclinic.org',
    allowedDomains: ['mayoclinic.org'],
    discoveryType: 'sitemap',
    entryUrls: [
      'https://www.mayoclinic.org/chinese_patient_consumer_web.xml',
    ],
    region: 'US',
    language: 'zh',
    locale: 'zh-CN',
    audience: ['孕妇', '新生儿家长', '婴幼儿家长', '母婴家庭'],
    topics: ['pregnancy', 'newborn', 'feeding', 'vaccination', 'common-symptoms', 'development'],
    enabled: true,
    fetchIntervalMinutes: 720,
    maxPagesPerRun: 180,
    parserId: 'mayo',
  },
  {
    id: 'msd-manuals-cn',
    org: 'MSD Manuals',
    baseUrl: 'https://www.msdmanuals.cn',
    allowedDomains: ['msdmanuals.cn', 'www.msdmanuals.cn'],
    discoveryType: 'sitemap',
    entryUrls: [
      'https://www.msdmanuals.cn/sitemap-index.xml',
    ],
    region: 'GLOBAL',
    language: 'zh',
    locale: 'zh-CN',
    audience: ['孕妇', '新生儿家长', '婴幼儿家长', '母婴家庭'],
    topics: ['pregnancy', 'newborn', 'feeding', 'vaccination', 'common-symptoms'],
    enabled: true,
    fetchIntervalMinutes: 720,
    maxPagesPerRun: 180,
    parserId: 'msd-manuals',
  },
  {
    id: 'nhc-fys',
    org: '国家卫生健康委员会妇幼健康司',
    baseUrl: 'https://www.nhc.gov.cn',
    allowedDomains: ['nhc.gov.cn'],
    discoveryType: 'index_page',
    entryUrls: [
      'https://www.nhc.gov.cn/fys/new_index.shtml',
      'https://www.nhc.gov.cn/fys/c100077/new_list.shtml',
      'https://www.nhc.gov.cn/fys/c100078/new_list.shtml',
      'https://www.nhc.gov.cn/fys/pztq/new_list.shtml',
      'https://www.nhc.gov.cn/fys/mrwy/mrwy_index.shtml',
      'https://www.nhc.gov.cn/fys/mrgzdt/mrwy_list.shtml',
      'https://www.nhc.gov.cn/fys/mrkpxc/mrwy_list.shtml',
      'https://www.nhc.gov.cn/jnr/kajrjjr/dzhxpr_lmtt.shtml',
      'https://www.nhc.gov.cn/jnr/jrjjk/csqxr_lmtt.shtml',
      'https://www.nhc.gov.cn/wjw/wzdt/wzdt.shtml',
    ],
    region: 'CN',
    language: 'zh',
    locale: 'zh-CN',
    audience: ['孕妇', '产后妈妈', '新生儿家长', '婴幼儿家长'],
    topics: ['pregnancy', 'newborn', 'feeding', 'development', 'policy'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 120,
    parserId: 'cn-health',
  },
  {
    id: 'nhc-rkjt',
    org: '国家卫生健康委员会人口监测与家庭发展司',
    baseUrl: 'https://www.nhc.gov.cn',
    allowedDomains: ['nhc.gov.cn'],
    discoveryType: 'index_page',
    entryUrls: [
      'https://www.nhc.gov.cn/rkjcyjtfzs/new_index.shtml',
      'https://www.nhc.gov.cn/rkjcyjtfzs/c100147/new_list.shtml',
      'https://www.nhc.gov.cn/rkjcyjtfzs/c100148/new_list.shtml',
      'https://www.nhc.gov.cn/rkjcyjtfzs/s9993/new_list.shtml',
    ],
    region: 'CN',
    language: 'zh',
    locale: 'zh-CN',
    audience: ['备孕家庭', '孕妇', '新生儿家长', '婴幼儿家长'],
    topics: ['development', 'newborn', 'policy', 'feeding'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 100,
    parserId: 'cn-health',
  },
  {
    id: 'chinacdc-immunization',
    org: '中国疾病预防控制中心',
    baseUrl: 'https://www.chinacdc.cn',
    allowedDomains: ['chinacdc.cn'],
    discoveryType: 'index_page',
    entryUrls: [
      'https://www.chinacdc.cn/jkkp/mygh/ztrxc/',
      'https://www.chinacdc.cn/jkkp/mygh/ymyf/',
      'https://www.chinacdc.cn/jkyj/mygh02/jswj_mygh/myfw_mygh/',
    ],
    region: 'CN',
    language: 'zh',
    locale: 'zh-CN',
    audience: ['新生儿家长', '婴幼儿家长', '母婴家庭'],
    topics: ['vaccination', 'newborn', 'feeding', 'common-symptoms', 'policy'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 120,
    parserId: 'cn-health',
  },
  {
    id: 'chinacdc-nutrition',
    org: '中国疾病预防控制中心营养与健康所',
    baseUrl: 'https://www.chinacdc.cn',
    allowedDomains: ['chinacdc.cn'],
    discoveryType: 'index_page',
    entryUrls: [
      'https://www.chinacdc.cn/jkkp/yyjk/rqyy/',
      'https://www.chinacdc.cn/jkkp/yyjk/jbyy/',
    ],
    region: 'CN',
    language: 'zh',
    locale: 'zh-CN',
    audience: ['孕妇', '新生儿家长', '婴幼儿家长', '母婴家庭'],
    topics: ['feeding', 'development', 'newborn', 'common-symptoms'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 120,
    parserId: 'cn-health',
  },
  {
    id: 'govcn-muying',
    org: '中国政府网',
    baseUrl: 'https://www.gov.cn',
    allowedDomains: ['gov.cn'],
    discoveryType: 'api',
    entryUrls: [
      'https://www.gov.cn/zhengce/zuixin/ZUIXINZHENGCE.json',
    ],
    region: 'CN',
    language: 'zh',
    locale: 'zh-CN',
    audience: ['备孕家庭', '孕妇', '新生儿家长', '婴幼儿家长'],
    topics: ['pregnancy', 'newborn', 'feeding', 'development', 'policy'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 100,
    parserId: 'cn-health',
  },
  {
    id: 'govcn-jiedu-muying',
    org: '中国政府网政策解读',
    baseUrl: 'https://www.gov.cn',
    allowedDomains: ['gov.cn'],
    discoveryType: 'api',
    entryUrls: [
      'https://www.gov.cn/zhengce/jiedu/ZCJD_QZ.json',
    ],
    region: 'CN',
    language: 'zh',
    locale: 'zh-CN',
    audience: ['备孕家庭', '孕妇', '新生儿家长', '婴幼儿家长'],
    topics: ['pregnancy', 'newborn', 'feeding', 'development', 'policy'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 120,
    parserId: 'cn-health',
  },
  {
    id: 'ndcpa-immunization',
    org: '国家疾病预防控制局',
    baseUrl: 'https://www.ndcpa.gov.cn',
    allowedDomains: ['ndcpa.gov.cn'],
    discoveryType: 'index_page',
    entryUrls: [
      'https://www.ndcpa.gov.cn/jbkzzx/c100012/common/list.html',
      'https://www.ndcpa.gov.cn/jbkzzx/c100014/common/list.html',
    ],
    region: 'CN',
    language: 'zh',
    locale: 'zh-CN',
    audience: ['孕妇', '新生儿家长', '婴幼儿家长', '母婴家庭'],
    topics: ['vaccination', 'policy', 'newborn', 'common-symptoms'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 120,
    parserId: 'cn-health',
  },
  {
    id: 'ndcpa-public-health',
    org: '国家疾病预防控制局',
    baseUrl: 'https://www.ndcpa.gov.cn',
    allowedDomains: ['ndcpa.gov.cn'],
    discoveryType: 'index_page',
    entryUrls: [
      'https://www.ndcpa.gov.cn/jbkzzx/c100013/common/list.html',
      'https://www.ndcpa.gov.cn/jbkzzx/c100016/second/list.html',
    ],
    region: 'CN',
    language: 'zh',
    locale: 'zh-CN',
    audience: ['孕妇', '新生儿家长', '婴幼儿家长', '母婴家庭'],
    topics: ['policy', 'common-symptoms', 'vaccination', 'newborn'],
    enabled: true,
    fetchIntervalMinutes: 360,
    maxPagesPerRun: 120,
    parserId: 'cn-health',
  },
  // Third-party medical content platform. Disabled by default because the
  // site's robots policy explicitly forbids large-language-model crawlers.
  {
    id: 'dxy-maternal',
    org: '丁香医生',
    baseUrl: 'https://dxy.com',
    allowedDomains: ['dxy.com', 'm.dxy.com'],
    discoveryType: 'index_page',
    entryUrls: [
      'https://m.dxy.com/articles/24826',
      'https://dxy.com/',
      'https://dxy.com/articles/recommend/doctors',
    ],
    region: 'CN',
    language: 'zh',
    locale: 'zh-CN',
    audience: ['备孕家庭', '孕妇', '新生儿家长', '婴幼儿家长'],
    topics: ['pregnancy', 'newborn', 'feeding', 'common-symptoms'],
    enabled: false,
    fetchIntervalMinutes: 720,
    maxPagesPerRun: 60,
    maxDiscoveryIndexPages: 3,
    parserId: 'dxy',
  },
  // Third-party medical content platform discovered from mother-and-baby
  // category pages, separated from official authority sources.
  {
    id: 'chunyu-maternal',
    org: '春雨医生',
    baseUrl: 'https://m.chunyuyisheng.com',
    allowedDomains: ['m.chunyuyisheng.com', 'www.chunyuyisheng.com', 'chunyuyisheng.com'],
    discoveryType: 'index_page',
    entryUrls: [
      'https://m.chunyuyisheng.com/m/health_news_home/?channel_id=6',
    ],
    region: 'CN',
    language: 'zh',
    locale: 'zh-CN',
    audience: ['备孕家庭', '孕妇', '新生儿家长', '婴幼儿家长'],
    topics: ['pregnancy', 'newborn', 'feeding', 'common-symptoms'],
    enabled: true,
    fetchIntervalMinutes: 720,
    maxPagesPerRun: 80,
    maxDiscoveryIndexPages: 8,
    parserId: 'chunyu',
  },
  {
    id: 'youlai-pregnancy-guide',
    org: '有来医生',
    baseUrl: 'https://m.youlai.cn',
    allowedDomains: ['m.youlai.cn', 'youlai.cn'],
    discoveryType: 'index_page',
    entryUrls: [
      'https://m.youlai.cn/special/advisor/vezz0BpCQ3.html',
    ],
    region: 'CN',
    language: 'zh',
    locale: 'zh-CN',
    audience: ['备孕家庭', '孕妇'],
    topics: ['pregnancy', 'feeding', 'development'],
    enabled: true,
    fetchIntervalMinutes: 1440,
    maxPagesPerRun: 45,
    maxDiscoveryIndexPages: 45,
    parserId: 'youlai',
  },
  {
    id: 'familydoctor-maternal',
    org: '家庭医生在线',
    baseUrl: 'https://www.familydoctor.com.cn',
    allowedDomains: ['familydoctor.com.cn', 'www.familydoctor.com.cn', 'm.familydoctor.com.cn'],
    discoveryType: 'index_page',
    entryUrls: [
      'https://www.familydoctor.com.cn/yc/',
      'https://www.familydoctor.com.cn/baby/baby/jbhl/',
    ],
    region: 'CN',
    language: 'zh',
    locale: 'zh-CN',
    audience: ['备孕家庭', '孕妇', '新生儿家长', '婴幼儿家长'],
    topics: ['pregnancy', 'newborn', 'feeding', 'common-symptoms', 'development'],
    enabled: true,
    fetchIntervalMinutes: 1440,
    maxPagesPerRun: 120,
    maxDiscoveryIndexPages: 8,
    parserId: 'familydoctor',
  },
];

export const OFFICIAL_AUTHORITY_SOURCE_IDS = new Set([
  'who',
  'cdc',
  'aap',
  'acog',
  'nhs',
  'mayo-clinic-zh',
  'msd-manuals-cn',
  'nhc-fys',
  'nhc-rkjt',
  'chinacdc-immunization',
  'chinacdc-nutrition',
  'govcn-muying',
  'govcn-jiedu-muying',
  'ndcpa-immunization',
  'ndcpa-public-health',
]);

export function getAuthoritySourceConfig(sourceId: string): AuthoritySourceConfig | undefined {
  return AUTHORITY_SOURCES.find((source) => source.id === sourceId);
}

export function listEnabledAuthoritySources(): AuthoritySourceConfig[] {
  return AUTHORITY_SOURCES.filter((source) => source.enabled);
}

export function listEnabledOfficialAuthoritySources(): AuthoritySourceConfig[] {
  return AUTHORITY_SOURCES.filter((source) => source.enabled && OFFICIAL_AUTHORITY_SOURCE_IDS.has(source.id));
}

export function inferAuthorityLocaleDefaults(
  sourceId?: string,
  region?: string,
): { sourceLanguage: 'zh' | 'en'; sourceLocale: string } {
  const matched = sourceId ? getAuthoritySourceConfig(sourceId) : undefined;
  if (matched) {
    return {
      sourceLanguage: matched.language,
      sourceLocale: matched.locale,
    };
  }

  if (region === 'CN') {
    return { sourceLanguage: 'zh', sourceLocale: 'zh-CN' };
  }

  if (region === 'UK') {
    return { sourceLanguage: 'en', sourceLocale: 'en-GB' };
  }

  if (region === 'US') {
    return { sourceLanguage: 'en', sourceLocale: 'en-US' };
  }

  return { sourceLanguage: 'en', sourceLocale: 'en' };
}

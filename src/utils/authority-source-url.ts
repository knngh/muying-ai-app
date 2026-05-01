interface AuthoritySourceUrlRecord {
  source_id?: string;
  source_url?: string;
  url?: string;
  source_org?: string;
  source?: string;
  title?: string;
  question?: string;
}

export function isIndexLikeAuthorityUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (/\/(?:article|articles)\/\d+\/?$/.test(pathname) || /\/\d+\/?$/.test(pathname)) {
      return false;
    }

    return pathname.endsWith('/')
      || /\/(?:index|new_index)\.(?:html?|shtml)$/.test(pathname)
      || /\/(?:common|second|list)\/list\.html$/.test(pathname);
  } catch {
    return true;
  }
}

function getAuthoritySourceUrl(record: AuthoritySourceUrlRecord): string {
  return (record.source_url || record.url || '').trim();
}

function getAuthoritySourceTitle(record: AuthoritySourceUrlRecord): string {
  return (record.title || record.question || '').trim().toLowerCase();
}

function getAuthoritySourceText(record: AuthoritySourceUrlRecord, url: string, title: string): string {
  return `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url} ${title}`.toLowerCase();
}

function isFocusedMaternalInfantZhText(text: string): boolean {
  return /(3岁以下|三岁以下|0[~～-]3岁|0到3岁|婴幼儿|婴儿|新生儿|宝宝|孕产|孕妇|孕期|孕前|备孕|产后|分娩|产科|生育|母婴|母乳|哺乳|喂养|辅食|托育|照护|育儿补贴|百白破|配方乳粉)/u.test(text);
}

function isBroadChildOrPublicPolicyZhText(text: string): boolean {
  return /(儿童青少年|青少年|中小学生|学校卫生|学前教育|幼儿园|大班儿童|学籍|入学|儿童友好(?:建设|医院)?|儿童福利|困境儿童|监护缺失儿童|残疾儿童|特殊教育|儿童医疗卫生服务|儿童药品|儿童参加基本医疗保险|儿童青少年近视|近视防控|五健|孤独症|眼保健|收养评估|妇女儿童发展纲要|儿童发展纲要|疟原虫|疾病预防控制行业标准|餐饮住宿|个人消费贷|购车指标|文旅|养老|十五五|生育休假制度|生育支持政策体系|优化生育政策工作|联席会议|三孩生育政策|价格形成机制|示范城市|民用机场母婴室|消防安全|生育登记)/u.test(text);
}

function isCentralGovcnText(text: string): boolean {
  return /govcn-muying|govcn-jiedu-muying|中国政府网|https?:\/\/(?:www\.)?gov\.cn\//.test(text);
}

function isGovcnHealthGuidanceText(text: string): boolean {
  return /(婴幼儿营养喂养评估|婴幼儿早期发展服务指南|3岁以下婴幼儿健康养育照护指南|婴幼儿配方乳粉|百白破|白破疫苗|免疫程序|危重孕产妇救治|孕产妇疾病救治|安全助产|儿童和孕产妇.{0,20}疫情防控|生育友好医院)/u.test(text);
}

function isGovcnSupportOrBenefitPolicyText(text: string): boolean {
  return /(育儿补贴|补贴制度|申领|支付宝|微信|中央财政|预算|托育服务|普惠托育|生育保险|大病保险|落地即参保|医保局|产科服务价格|医疗服务价格|个税|个人所得税|专项附加扣除|减税|红包|积极生育支持|生育支持政策|实施方案)/u.test(text);
}

function isOutOfScopeChineseAuthority(record: AuthoritySourceUrlRecord, url: string, title: string): boolean {
  const text = getAuthoritySourceText(record, url, title);
  const isChineseAuthority = isNhcSource(record, url)
    || isChinaCdcSource(record, url)
    || isNdcpaSource(record, url)
    || isNcwchSource(record, url)
    || isMchscnSource(record, url)
    || isCnsocSource(record, url)
    || isChinanutriSource(record, url)
    || isCentralGovcnText(text);

  if (!isChineseAuthority) {
    return false;
  }

  if (isBroadChildOrPublicPolicyZhText(text) && !/(3岁以下|三岁以下|0[~～-]3岁|0到3岁|婴幼儿|婴儿|新生儿|孕产|孕妇|孕期|备孕|产后|分娩|产科|生育|托育|育儿补贴|母乳|哺乳|喂养|辅食|配方乳粉|百白破)/u.test(text)) {
    return true;
  }

  if (isCentralGovcnText(text)) {
    if (isGovcnSupportOrBenefitPolicyText(text) && !isGovcnHealthGuidanceText(text)) {
      return true;
    }

    if (/(十五五|生育休假制度|生育支持政策体系|优化生育政策工作|联席会议|三孩生育政策|价格形成机制|示范城市|民用机场母婴室|消防安全|生育登记)/u.test(text)
      && !/(育儿补贴制度|3岁以下|三岁以下|0[~～-]3岁|0到3岁|婴幼儿[^，。！？]{0,12}指南|百白破|生育保险|新生儿[^，。！？]{0,8}参保)/u.test(text)) {
      return true;
    }

    if (/(个人消费贷|购车指标|餐饮住宿|文旅|养老|社保|两新|消费品以旧换新)/u.test(text)
      && !/(3岁以下|三岁以下|0[~～-]3岁|0到3岁|婴幼儿照护|生育保险)/u.test(text)) {
      return true;
    }

    if (isBroadChildOrPublicPolicyZhText(text) && !/(3岁以下|三岁以下|0[~～-]3岁|0到3岁|婴幼儿|新生儿|孕产|孕妇|孕期|产后|分娩|产科|生育友好|生育支持|托育|育儿补贴|母乳|喂养|配方乳粉|百白破)/u.test(text)) {
      return true;
    }

    return !isFocusedMaternalInfantZhText(text);
  }

  if (isNdcpaSource(record, url)) {
    return !/(婴幼儿|新生儿|孕产|孕妇|疫苗|接种|百白破|母乳|喂养)/u.test(text);
  }

  return false;
}

function isOutOfScopeEnglishAuthority(record: AuthoritySourceUrlRecord, url: string, title: string): boolean {
  const text = getAuthoritySourceText(record, url, title);
  const pathname = normalizePathname(url);

  if (isAapSource(record, url)) {
    if (/\/english\/ages-stages\/(?:gradeschool|teen|young-adult|preschool)\//i.test(pathname)
      || /\/(?:school|puberty|fitness)\//i.test(pathname)
      || /\/pages\/default\.aspx$/i.test(pathname)) {
      return true;
    }
  }

  if (isCdcSource(record, url)) {
    if (/\/spanish\//i.test(pathname)
      || /\/parents\/(?:teens|children)\//i.test(pathname)
      || /\/contraception\/hcp\//i.test(pathname)
      || /\/ncbddd\/about\//i.test(pathname)
      || /\/breastfeeding\/php\/resources\//i.test(pathname)
      || /\/early-care\//i.test(pathname)) {
      return true;
    }
  }

  if (isNhsSource(record, url)) {
    if (/\/contraception\//i.test(pathname)
      || /\/mental-health\/children-and-young-adults\//i.test(pathname)
      || /\/social-care-and-support\/caring-for-children-and-young-people/i.test(pathname)
      || /\/conditions\/ectopic-pregnancy\//i.test(pathname)
      || /\/pregnancy\/your-pregnancy-care\/termination-for-fetal-anomaly/i.test(pathname)) {
      return true;
    }
  }

  if (isAcogSource(record, url)) {
    if (/nonpregnant|cervical cancer|immigrants|collaboration in practice|breast cancer survivorship|clinical practice update/i.test(text)) {
      return true;
    }
  }

  return false;
}

function isChinaCdcSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /chinacdc-immunization|中国疾病预防控制中心|chinacdc\.cn/.test(sourceText);
}

function isNdcpaSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /ndcpa-immunization|ndcpa-public-health|国家疾病预防控制局|ndcpa\.gov\.cn/.test(sourceText);
}

function isDxySource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /dxy-maternal|丁香医生|dxy\.com/.test(sourceText);
}

function isChunyuSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /chunyu-maternal|春雨医生|chunyuyisheng\.com/.test(sourceText);
}

function isYoulaiSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /youlai-pregnancy-guide|有来医生|youlai\.cn/.test(sourceText);
}

function isFamilydoctorSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /familydoctor-maternal|家庭医生在线|familydoctor\.com\.cn/.test(sourceText);
}

function isYilianmeitiSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /yilianmeiti-maternal-child|医联媒体|yilianmeiti\.com/.test(sourceText);
}

function isNcwchSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /ncwch-maternal-child-health|国家卫生健康委妇幼健康中心|ncwchnhc\.org\.cn/.test(sourceText);
}

function isMchscnSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /mchscn-monitoring|全国妇幼卫生监测办公室|中国出生缺陷监测中心|mchscn\.cn/.test(sourceText);
}

function isCnsocSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /cnsoc-dietary-guidelines|中国营养学会|中国居民膳食指南|dg\.cnsoc\.org/.test(sourceText);
}

function isChinanutriSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /chinanutri-maternal-child|中国疾病预防控制中心营养与健康所|chinanutri\.cn/.test(sourceText);
}

function isNhcSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /nhc-fys|nhc-rkjt|国家卫生健康委员会|国家卫健委|nhc\.gov\.cn/.test(sourceText);
}

function normalizePathname(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase().replace(/\/+$/g, '');
    return pathname || '/';
  } catch {
    return '/';
  }
}

function matchesExactLandingPath(url: string, candidates: string[]): boolean {
  const pathname = normalizePathname(url);
  return candidates.includes(pathname);
}

function isWhoSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /\bwho\b|who\.int/.test(sourceText);
}

function isCdcSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /\bcdc\b|cdc\.gov/.test(sourceText);
}

function isCdcHubPage(title: string, url: string): boolean {
  const pathname = normalizePathname(url);

  if (pathname.endsWith('/site.html')) {
    return true;
  }

  if (/\/parents\/spanish\/(?:infants|children)\/index\.html$/i.test(pathname)) {
    return true;
  }

  if (
    /\/(about|resources|data-research|features|impact|budget-funding|provider-tools|communication-resources|prevention|caring|testing|disability-safety|positive-parenting-tips|guidelines-recommendations|contraceptive-guidance)\/index\.html$/i.test(pathname)
    || /\/php\/(resources|guidelines-recommendations|breastfeeding-strategies)\/index\.html$/i.test(pathname)
    || /\/parents\/(infants|children)\/index\.html$/i.test(pathname)
    || /\/(ncbddd|pregnancy|contraception|child-development|breastfeeding)\/index\.html$/i.test(pathname)
    || /\/ncbddd\/(?:hearingloss|nofo-autism-fxs)\/index\.html$/i.test(pathname)
  ) {
    return true;
  }

  const titleSegments = title
    .split('|')
    .map((segment) => segment.trim().toLowerCase())
    .filter((segment) => segment && segment !== 'cdc');
  const hasRepeatedTitleSegments = titleSegments.length >= 2
    && new Set(titleSegments).size < titleSegments.length;

  return (
    /^(child development|breastfeeding|pregnancy|contraception|national center on birth defects and developmental disabilities \(ncbddd\)|information about infants & toddlers \(ages 0-3\)|information about young children \(ages 4-11\)|site index)\s*\|/i.test(title)
    || hasRepeatedTitleSegments
  ) && pathname.endsWith('.html');
}

function isAapSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /\baap\b|healthychildren\.org/.test(sourceText);
}

function isAcogSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /\bacog\b|acog\.org/.test(sourceText);
}

function isAcogTopicHubPage(url: string): boolean {
  const pathname = normalizePathname(url);
  return /^\/topics\/[^/]+$/i.test(pathname);
}

function isNhsSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /\bnhs\b|nhs\.uk/.test(sourceText);
}

function isMayoSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /mayo-clinic-zh|\bmayo\b|mayoclinic\.org/.test(sourceText);
}

function isMsdSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /msd-manuals-cn|\bmsd\b|msdmanuals\.cn/.test(sourceText);
}

export function shouldFilterAuthoritySourceUrl(record: AuthoritySourceUrlRecord): boolean {
  const url = getAuthoritySourceUrl(record);
  const title = getAuthoritySourceTitle(record);
  if (!url) {
    return false;
  }

  if (/(^|[\s|:])site index(?:[\s|:]|$)|(^|[\s|:])índice del sitio(?:[\s|:]|$)|\ba-z index\b|\btopics a-z\b|\ball topics\b/i.test(title)) {
    return true;
  }

  if (/^(child development|breastfeeding|pregnancy|contraception)\s*\|\s*cdc$/i.test(title)) {
    return true;
  }

  if (isOutOfScopeChineseAuthority(record, url, title) || isOutOfScopeEnglishAuthority(record, url, title)) {
    return true;
  }

  if (isNcwchSource(record, url)) {
    return !/\/content\/content\.html\?id=\d+(?:$|[&#])/i.test(url);
  }

  if (isMchscnSource(record, url)) {
    return isIndexLikeAuthorityUrl(url)
      || !/\/[A-Za-z]+-\d+\/\d+\.html(?:$|[?#])/i.test(url);
  }

  if (isCnsocSource(record, url)) {
    return isIndexLikeAuthorityUrl(url)
      || !/\/article\/04\/[^/?#]+\.html(?:$|[?#])/i.test(url);
  }

  if (isChinanutriSource(record, url)) {
    return isIndexLikeAuthorityUrl(url)
      || /\/(?:gzdt|dqjs|tzgg_6537|kytd|rcpy|djgz|xxgk)\//i.test(url)
      || !/\/(?:xwzx_238\/xyxw|yyjkzxpt\/yyjkkpzx|jkyy|yyjk)\/\d{6}\/t\d{8}_\d+\.(?:html?|shtml)(?:$|[?#])/i.test(url);
  }

  if (isChinaCdcSource(record, url)) {
    return isIndexLikeAuthorityUrl(url)
      || !/(?:\/t\d{8}_\d+\.(?:html?|shtml)|\.pdf(?:$|[?#]))/i.test(url);
  }

  if (isNdcpaSource(record, url)) {
    return isIndexLikeAuthorityUrl(url)
      || !/\/common\/content\/content_\d+\.html(?:$|[?#])/i.test(url);
  }

  if (isDxySource(record, url)) {
    return isIndexLikeAuthorityUrl(url)
      || !/\/article\/\d+(?:$|[?#])/i.test(url);
  }

  if (isChunyuSource(record, url)) {
    return isIndexLikeAuthorityUrl(url)
      || !/\/m\/article\/\d+\/?(?:$|[?#])/i.test(url);
  }

  if (isYoulaiSource(record, url)) {
    return !/\/special\/advisor\/[A-Za-z0-9]+\.html(?:$|[?#])/i.test(url);
  }

  if (isFamilydoctorSource(record, url)) {
    return isIndexLikeAuthorityUrl(url)
      || !/\/(?:baby\/)?a\/\d{6}\/\d+\.html(?:$|[?#])/i.test(url);
  }

  if (isYilianmeitiSource(record, url)) {
    return isIndexLikeAuthorityUrl(url)
      || !/\/article\/\d+\.html(?:$|[?#])/i.test(url);
  }

  if (isNhcSource(record, url)) {
    if (/\/(?:fys|rkjcyjtfzs|jnr)\/[^/?#]+\/(?:[^/?#]+_)?(?:index|list|lmtt)\.(?:html?|shtml)$/i.test(url)) {
      return true;
    }

    return isIndexLikeAuthorityUrl(url)
      || !/\/(?:fys|rkjcyjtfzs|wjw|wsb|jnr)\/(?:[^/?#]+\/){0,3}[^/?#]+\.(?:html?|shtml|pdf)(?:$|[?#])/i.test(url);
  }

  if (isWhoSource(record, url)) {
    return matchesExactLandingPath(url, [
      '/',
      '/news-room',
      '/health-topics',
      '/health-topics/maternal-health',
      '/health-topics/child-health',
      '/health-topics/breastfeeding',
      '/health-topics/vaccines-and-immunization',
    ]);
  }

  if (isCdcSource(record, url)) {
    if (isCdcHubPage(title, url)) {
      return true;
    }

    return matchesExactLandingPath(url, [
      '/',
      '/pregnancy',
      '/breastfeeding',
      '/parents',
      '/child-development',
      '/vaccines-children',
      '/vaccines-pregnancy',
      '/vaccines-for-children',
      '/reproductivehealth',
      '/womens-health',
      '/contraception',
      '/growthcharts',
      '/ncbddd',
      '/act-early',
      '/early-care',
      '/protect-children',
      '/medicines-and-pregnancy',
      '/opioid-use-during-pregnancy',
      '/pregnancy-hiv-std-tb-hepatitis',
    ]);
  }

  if (isAapSource(record, url)) {
    return matchesExactLandingPath(url, [
      '/',
      '/english/ages-stages',
      '/english/health-issues',
      '/english/healthy-living',
      '/english/safety-prevention',
      '/english/family-life',
    ]);
  }

  if (isAcogSource(record, url)) {
    if (isAcogTopicHubPage(url)) {
      return true;
    }

    return matchesExactLandingPath(url, [
      '/',
      '/clinical',
      '/womens-health',
      '/topics',
    ]);
  }

  if (isNhsSource(record, url)) {
    return matchesExactLandingPath(url, [
      '/',
      '/pregnancy',
      '/conditions',
      '/conditions/baby',
      '/conditions/pregnancy-and-baby',
      '/medicines',
      '/vaccinations',
      '/start-for-life',
    ]);
  }

  if (isMayoSource(record, url)) {
    return matchesExactLandingPath(url, [
      '/',
      '/zh-hans',
      '/zh-hans/about-mayo-clinic',
    ]);
  }

  if (isMsdSource(record, url)) {
    return matchesExactLandingPath(url, [
      '/',
      '/home',
    ]);
  }

  return false;
}

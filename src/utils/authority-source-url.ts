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

function isAapSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /\baap\b|healthychildren\.org/.test(sourceText);
}

function isAcogSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /\bacog\b|acog\.org/.test(sourceText);
}

function isNhsSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /\bnhs\b|nhs\.uk/.test(sourceText);
}

export function shouldFilterAuthoritySourceUrl(record: AuthoritySourceUrlRecord): boolean {
  const url = getAuthoritySourceUrl(record);
  const title = getAuthoritySourceTitle(record);
  if (!url) {
    return false;
  }

  if (/(^|[\s|:])site index(?:[\s|:]|$)|\ba-z index\b|\btopics a-z\b|\ball topics\b/i.test(title)) {
    return true;
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

  if (isNhcSource(record, url)) {
    return isIndexLikeAuthorityUrl(url)
      || !/\/(?:fys|rkjcyjtfzs|wjw|wsb)\/(?:c\d+\/)?(?:\d{6,8}\/)?[^/?#]+\.(?:html?|shtml|pdf)(?:$|[?#])/i.test(url);
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

  return false;
}

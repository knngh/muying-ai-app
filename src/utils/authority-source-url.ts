interface AuthoritySourceUrlRecord {
  source_id?: string;
  source_url?: string;
  url?: string;
  source_org?: string;
  source?: string;
}

export function isIndexLikeAuthorityUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
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

function isChinaCdcSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /chinacdc-immunization|中国疾病预防控制中心|chinacdc\.cn/.test(sourceText);
}

function isNdcpaSource(record: AuthoritySourceUrlRecord, url: string): boolean {
  const sourceText = `${record.source_id || ''} ${record.source_org || ''} ${record.source || ''} ${url}`.toLowerCase();
  return /ndcpa-immunization|ndcpa-public-health|国家疾病预防控制局|ndcpa\.gov\.cn/.test(sourceText);
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
  if (!url) {
    return false;
  }

  if (isChinaCdcSource(record, url)) {
    return isIndexLikeAuthorityUrl(url)
      || !/(?:\/t\d{8}_\d+\.(?:html?|shtml)|\.pdf(?:$|[?#]))/i.test(url);
  }

  if (isNdcpaSource(record, url)) {
    return isIndexLikeAuthorityUrl(url)
      || !/\/common\/content\/content_\d+\.html(?:$|[?#])/i.test(url);
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

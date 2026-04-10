export interface AuthoritySourceLike {
  title?: string
  source?: string
  sourceOrg?: string
  sourceUrl?: string
  url?: string
  sourceLanguage?: string
  sourceLocale?: string
  region?: string
}

const CHINESE_AUTHORITY_PATTERNS = [
  /中国政府网/u,
  /中国政府网政策解读/u,
  /gov\.cn/i,
  /国家卫生健康委员会/u,
  /国家卫健委/u,
  /人口监测与家庭发展司/u,
  /中国疾控/u,
  /中国疾病预防控制中心/u,
  /中国疾病预防控制中心营养与健康所/u,
  /chinacdc/i,
  /国家疾病预防控制局/u,
  /ndcpa/i,
]

const CHINESE_AUTHORITY_DOMAINS = [
  'gov.cn',
  'nhc.gov.cn',
  'ndcpa.gov.cn',
  'chinacdc.cn',
]

function getSourceHost(url?: string): string {
  if (!url) {
    return ''
  }

  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export function isChineseAuthoritySource(source?: AuthoritySourceLike | null): boolean {
  if (!source) {
    return false
  }

  const locale = (source.sourceLocale || '').toLowerCase()
  if ((source.sourceLanguage || '').toLowerCase() === 'zh' || locale.startsWith('zh')) {
    return true
  }

  if ((source.region || '').toUpperCase() === 'CN') {
    return true
  }

  const host = getSourceHost(source.sourceUrl || source.url)
  if (host && CHINESE_AUTHORITY_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`))) {
    return true
  }

  const sourceText = [
    source.title || '',
    source.sourceOrg || '',
    source.source || '',
    source.sourceUrl || '',
    source.url || '',
    source.region || '',
  ].join(' ')

  return CHINESE_AUTHORITY_PATTERNS.some(pattern => pattern.test(sourceText))
}

export function getAuthorityRegionTag(source?: AuthoritySourceLike | null): 'cn' | 'global' {
  return isChineseAuthoritySource(source) ? 'cn' : 'global'
}

export function getAuthorityRegionLabel(source?: AuthoritySourceLike | null): string {
  return isChineseAuthoritySource(source) ? '中国权威源' : '国际权威源'
}

export function getAuthorityRegionPriority(source?: AuthoritySourceLike | null): number {
  return isChineseAuthoritySource(source) ? 0 : 1
}

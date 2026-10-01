// beihu-web Worker：
// - /api/* → 服务端反代 https://beihu.me（删 origin 头规避 CORS，beihu.me 零改动）
// - /sitemap.xml → 动态生成（数据源：后端文章列表接口，caches 缓存 + 软 TTL）
// - /__seo/* → 内部缓存键，挡掉外部探测
// - 其余 HTML 导航请求 → index.html + 按路径注入 SEO meta（HTMLRewriter 流式改写）
// 静态资产（/assets/*、robots.txt、llms.txt、og-default.png 等）由资产层直接服务，不进 Worker。

interface Env {
  ASSETS: { fetch(input: RequestInfo, init?: RequestInit): Promise<Response> }
}

interface Ctx {
  waitUntil(promise: Promise<unknown>): void
}

const SITE_ORIGIN = 'https://hibeihu.com'
const UPSTREAM_ORIGIN = 'https://beihu.me'

const CACHE_INDEX_KEY = new Request(SITE_ORIGIN + '/__seo/index.json')
const CACHE_SITEMAP_KEY = new Request(SITE_ORIGIN + '/__seo/sitemap.xml')
const INDEX_TTL_SEC = 12 * 3600 // 索引软过期
const SITEMAP_CACHE_TTL_SEC = 24 * 3600 // sitemap 物理缓存
const SITEMAP_SOFT_TTL_SEC = 12 * 3600 // 超过则后台重建
const SITEMAP_CLIENT_TTL_SEC = 43200
const MAX_PULL_PAGES = 40 // 子请求保险（免费版上限 50）

const SITE_NAME = '贝护妈妈'
const DEFAULT_TITLE = `${SITE_NAME} · 权威母婴知识库`
const DEFAULT_DESCRIPTION =
  '贝护妈妈权威母婴知识库：WHO、美国儿科学会、英国 NHS、国家卫健委等权威机构的孕育科普，覆盖备孕、孕期、产后与 0-3 岁育儿，持续同步更新。'

// ==================== SEO 索引数据 ====================

interface SeoIndexItem {
  slug: string
  title: string
  displayTitle?: string
  summary?: string
  displaySummary?: string
  publishedAt?: string
  updatedAt?: string
  sourceUpdatedAt?: string
  sourceOrg?: string
  sourceUrl?: string
  sourceLanguage?: string
}

interface PageMeta {
  title: string
  description: string
  canonicalPath: string
  ogType: 'website' | 'article'
  noindex?: boolean
  publishedTime?: string
  jsonLd: ReadonlyArray<Record<string, unknown>>
}

interface IsolateIndex {
  map: Map<string, SeoIndexItem>
  generatedAt: number
}

// isolate 级内存缓存（避免每请求 JSON.parse；single-flight 防并发重建）
let isolateIndex: IsolateIndex | null = null
let indexBuildPromise: Promise<void> | null = null

// ==================== 入口与路由分发 ====================

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      const response = await proxyApi(request)
      response.headers.set('x-worker-hit', 'api')
      return response
    }
    if (url.pathname === '/sitemap.xml') {
      const response = await handleSitemap(ctx)
      response.headers.set('x-worker-hit', 'sitemap')
      return response
    }
    if (url.pathname.startsWith('/__seo/')) {
      return new Response(null, { status: 404, headers: { 'x-worker-hit': 'blocked' } })
    }
    const response = await servePageWithMeta(request, env, ctx)
    response.headers.set('x-worker-hit', 'page')
    return response
  },
}

// ==================== /api/* 反代（原有逻辑，只字未改语义） ====================

async function proxyApi(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const upstream = new Request(UPSTREAM_ORIGIN + url.pathname + url.search, request)
  upstream.headers.delete('origin')
  const upstreamResponse = await fetch(upstream)
  const response = new Response(upstreamResponse.body, upstreamResponse)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

// ==================== HTML 页面 + meta 注入 ====================

async function servePageWithMeta(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const base = await env.ASSETS.fetch(request)
  const contentType = base.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) {
    // 非导航请求（如对不存在静态文件的探测）：保留资产层原始响应（404 等），不强加 no-cache
    return base
  }

  let meta: PageMeta
  try {
    meta = await resolvePageMeta(new URL(request.url).pathname, ctx)
  } catch {
    meta = DEFAULT_META
  }

  // HTMLRewriter.on 的第二参必须是 handlers 对象（{ element(el) }），裸函数不会被执行
  const html = new HTMLRewriter()
    .on('title', {
      element(element) {
        element.setInnerContent(meta.title)
      },
    })
    .on('meta[name="description"]', {
      element(element) {
        element.setAttribute('content', meta.description)
      },
    })
    .on('head', {
      element(element) {
        element.append(buildHeadBlock(meta), { html: true })
      },
    })
    .transform(base)

  const response = new Response(html.body, html)
  // HTML 必须 no-store：no-cache 允许 CF 边缘存储副本（部署后回旧 HTML/旧 hash 引用）
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return response
}

// ==================== meta 表 ====================

const ORG_JSONLD: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': SITE_ORIGIN + '/#org',
  name: SITE_NAME,
  url: SITE_ORIGIN + '/',
  logo: SITE_ORIGIN + '/og-default.png',
}

const DEFAULT_META: PageMeta = {
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  canonicalPath: '/knowledge',
  ogType: 'website',
  jsonLd: [
    ORG_JSONLD,
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': SITE_ORIGIN + '/#site',
      name: SITE_NAME,
      url: SITE_ORIGIN + '/',
      description: DEFAULT_DESCRIPTION,
      inLanguage: 'zh-CN',
      publisher: { '@id': SITE_ORIGIN + '/#org' },
    },
  ],
}

function noindexMeta(): PageMeta {
  return { ...DEFAULT_META, canonicalPath: '', noindex: true, jsonLd: [] }
}

// 登录墙/无搜索价值页面：noindex
const STATIC_PAGE_META: Record<string, PageMeta> = {
  '/': DEFAULT_META, // 客户端重定向 → /knowledge，canonical 指向 /knowledge
  '/knowledge': DEFAULT_META,
  '/login': noindexMeta(),
  '/chat': noindexMeta(),
  '/calendar': noindexMeta(),
  '/tools': noindexMeta(),
  '/tools/growth': noindexMeta(),
  '/tools/vaccines': noindexMeta(),
  '/tools/checkin': noindexMeta(),
  '/tools/names': noindexMeta(),
  '/profile': noindexMeta(),
}

async function resolvePageMeta(pathname: string, ctx: Ctx): Promise<PageMeta> {
  const exact = STATIC_PAGE_META[pathname]
  if (exact) return exact

  const match = pathname.match(/^\/knowledge\/([^/]+)$/)
  if (match) {
    const slug = decodeURIComponent(match[1])
    const index = await getSeoIndex(ctx)
    const item = index?.map.get(slug)
    if (item) return buildArticleMeta(item, pathname)
    // 索引未收录（新文章/缓存冷）：返回默认 meta，后台刷新索引（下次命中）
    ctx.waitUntil(refreshSeoIndex())
  }
  return noindexMeta() // 未知路径
}

// ==================== 文章 meta 构造 ====================

function isoDate(value?: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function languageOf(item: SeoIndexItem): string {
  if (item.displayTitle) return 'zh-CN'
  if (item.sourceLanguage === 'zh') return 'zh-CN'
  return item.sourceLanguage || 'zh-CN'
}

function buildArticleMeta(item: SeoIndexItem, pathname: string): PageMeta {
  const title = truncateText(striptags(item.displayTitle || item.title || ''), 110)
  const description = truncateText(striptags(item.displaySummary || item.summary || DEFAULT_DESCRIPTION), 160)
  const url = SITE_ORIGIN + pathname
  const published = isoDate(item.publishedAt || item.sourceUpdatedAt)
  const modified = isoDate(item.sourceUpdatedAt || item.updatedAt)

  const article: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    inLanguage: languageOf(item),
    isAccessibleForFree: true,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }
  if (published) article.datePublished = published
  if (modified) article.dateModified = modified
  if (item.sourceOrg) article.publisher = { '@type': 'Organization', name: item.sourceOrg }
  if (item.sourceUrl) article.isBasedOn = item.sourceUrl

  return {
    title: title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE,
    description,
    canonicalPath: pathname,
    ogType: 'article',
    publishedTime: published,
    jsonLd: [article],
  }
}

// ==================== 注入块与工具 ====================

function buildHeadBlock(meta: PageMeta): string {
  if (meta.noindex) {
    return '<meta name="robots" content="noindex">'
  }
  const url = SITE_ORIGIN + meta.canonicalPath
  const parts: string[] = [
    `<link rel="canonical" href="${escapeHtmlAttr(url)}">`,
    `<meta property="og:title" content="${escapeHtmlAttr(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtmlAttr(meta.description)}">`,
    `<meta property="og:type" content="${meta.ogType}">`,
    `<meta property="og:url" content="${escapeHtmlAttr(url)}">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:locale" content="zh_CN">`,
    `<meta property="og:image" content="${SITE_ORIGIN}/og-default.png">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ]
  if (meta.publishedTime) {
    parts.push(`<meta property="article:published_time" content="${escapeHtmlAttr(meta.publishedTime)}">`)
  }
  for (const entry of meta.jsonLd) {
    parts.push(`<script type="application/ld+json">${escapeJsonLd(entry)}</script>`)
  }
  return parts.join('\n')
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function striptags(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*`>]/g, ' ')
    .replace(/[\x5B\x5D]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateText(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, max - 1) + '…'
}

// ==================== 索引缓存层 ====================

async function getSeoIndex(ctx: Ctx): Promise<IsolateIndex | null> {
  const now = Date.now()
  if (isolateIndex && now - isolateIndex.generatedAt < INDEX_TTL_SEC * 1000) {
    return isolateIndex
  }
  const cached = await caches.default.match(CACHE_INDEX_KEY)
  if (cached) {
    try {
      const body = (await cached.json()) as { generatedAt: number; items: SeoIndexItem[] }
      isolateIndex = {
        map: new Map(body.items.map((item) => [item.slug, item])),
        generatedAt: body.generatedAt,
      }
      return isolateIndex
    } catch {
      // 缓存损坏 → 走重建
    }
  }
  ctx.waitUntil(refreshSeoIndex())
  return isolateIndex // 可能为 null（冷启动）或过期旧值（软过期语义）
}

function refreshSeoIndex(): Promise<void> {
  if (indexBuildPromise) return indexBuildPromise
  indexBuildPromise = (async () => {
    try {
      const items = await pullAllArticleList()
      const generatedAt = Date.now()
      const body = JSON.stringify({ generatedAt, items })
      // caches.put 遵循被存 Response 的 Cache-Control，必须显式可缓存头；失败静默（put 总 resolve）
      await caches.default.put(
        CACHE_INDEX_KEY,
        new Response(body, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${SITEMAP_CACHE_TTL_SEC}`,
          },
        }),
      )
      isolateIndex = { map: new Map(items.map((item) => [item.slug, item])), generatedAt }
    } catch {
      // 上游异常：保留旧缓存与旧 isolateIndex
    } finally {
      indexBuildPromise = null
    }
  })()
  return indexBuildPromise
}

async function pullAllArticleList(): Promise<SeoIndexItem[]> {
  const out: SeoIndexItem[] = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages && page <= MAX_PULL_PAGES) {
    // 全新 Request（干净头，不继承客户端 IP/Cookie），按 Worker 出口 IP 计入限流
    const response = await fetch(
      `${UPSTREAM_ORIGIN}/api/v1/articles?contentType=authority&page=${page}&pageSize=100`,
      { headers: { accept: 'application/json' } },
    )
    if (!response.ok) throw new Error(`upstream ${response.status}`)
    const json = (await response.json()) as {
      code: number
      data?: { list: SeoIndexItem[]; pagination: { totalPages: number } }
    }
    if (json.code !== 0 || !json.data) throw new Error('upstream code')
    out.push(...json.data.list)
    totalPages = json.data.pagination.totalPages
    page += 1
  }
  return out
}

// ==================== sitemap ====================

async function handleSitemap(ctx: Ctx): Promise<Response> {
  try {
    const cached = await caches.default.match(CACHE_SITEMAP_KEY)
    if (cached) {
      const generatedAt = Number(cached.headers.get('x-generated-at') || 0)
      if (Date.now() - generatedAt > SITEMAP_SOFT_TTL_SEC * 1000) {
        ctx.waitUntil(rebuildSitemap(ctx))
      }
      return cached
    }
    return await rebuildSitemap(ctx) // 首次同步生成（1-3s，可接受）
  } catch {
    return minimalSitemap()
  }
}

async function rebuildSitemap(ctx: Ctx): Promise<Response> {
  try {
    let items: SeoIndexItem[]
    if (isolateIndex) {
      items = [...isolateIndex.map.values()]
    } else {
      const cached = await caches.default.match(CACHE_INDEX_KEY)
      if (cached) {
        const body = (await cached.json()) as { items: SeoIndexItem[] }
        items = body.items
      } else {
        items = await pullAllArticleList()
        ctx.waitUntil(refreshSeoIndex())
      }
    }
    const xml = buildSitemapXml(items)
    const generatedAt = String(Date.now())
    // 缓存副本（物理 TTL 长）与客户端响应（短 TTL）分开构造
    await caches.default.put(
      CACHE_SITEMAP_KEY,
      new Response(xml, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': `public, max-age=${SITEMAP_CACHE_TTL_SEC}`,
          'x-generated-at': generatedAt,
        },
      }),
    )
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': `public, max-age=${SITEMAP_CLIENT_TTL_SEC}`,
        'x-generated-at': generatedAt,
      },
    })
  } catch {
    return minimalSitemap()
  }
}

function buildSitemapXml(items: SeoIndexItem[]): string {
  const urls: string[] = [
    `  <url>\n    <loc>${SITE_ORIGIN}/knowledge</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
  ]
  for (const item of items) {
    const modified = isoDate(item.sourceUpdatedAt || item.updatedAt || item.publishedAt)
    const lastmod = modified ? `\n    <lastmod>${modified.slice(0, 10)}</lastmod>` : ''
    urls.push(
      `  <url>\n    <loc>${SITE_ORIGIN}/knowledge/${item.slug}</loc>${lastmod}\n  </url>`,
    )
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

function minimalSitemap(): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${SITE_ORIGIN}/knowledge</loc>\n  </url>\n</urlset>\n`
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

import type { RecentAIHitArticle } from '../types'

const RECENT_AI_HIT_ARTICLE_LIMIT = 6
const RECENT_AI_HIT_RETENTION_DAYS = 14
const RECENT_AI_HIT_MAX_FUTURE_SKEW_MS = 6 * 60 * 60 * 1000

export interface RecentAIHitArticleMeta {
  qaId?: string
  trigger?: 'hit_card' | 'knowledge_action'
  matchReason?: 'entry_meta' | 'source_url' | 'source_title' | 'source_keyword'
  originEntrySource?: string
  originReportId?: string
}

export interface RecentAIHitArticleSeed {
  slug: string
  articleId: number
  title: string
  summary: string
  source?: string
  sourceOrg?: string
  sourceLanguage?: 'zh' | 'en'
  sourceLocale?: string
  topic?: string
  stage?: string
  publishedAt?: string
  sourceUpdatedAt?: string
  createdAt: string
}

export function buildRecentAIHitArticle(
  article: RecentAIHitArticleSeed,
  input?: RecentAIHitArticleMeta,
): RecentAIHitArticle {
  return {
    slug: article.slug,
    articleId: article.articleId,
    title: article.title,
    summary: article.summary,
    source: article.source,
    sourceOrg: article.sourceOrg,
    sourceLanguage: article.sourceLanguage,
    sourceLocale: article.sourceLocale,
    topic: article.topic,
    stage: article.stage,
    publishedAt: article.publishedAt,
    sourceUpdatedAt: article.sourceUpdatedAt,
    createdAt: article.createdAt,
    lastHitAt: new Date().toISOString(),
    qaId: input?.qaId,
    trigger: input?.trigger,
    matchReason: input?.matchReason,
    originEntrySource: input?.originEntrySource,
    originReportId: input?.originReportId,
  }
}

export function isValidRecentAIHitTimestamp(value?: string, now = Date.now()) {
  if (!value) {
    return false
  }

  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) {
    return false
  }

  const maxAgeMs = RECENT_AI_HIT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  if (timestamp < now - maxAgeMs) {
    return false
  }

  if (timestamp > now + RECENT_AI_HIT_MAX_FUTURE_SKEW_MS) {
    return false
  }

  return true
}

export function sanitizeRecentAIHitArticles(
  items: RecentAIHitArticle[],
  now = Date.now(),
): RecentAIHitArticle[] {
  const deduped = new Map<string, RecentAIHitArticle>()

  for (const item of items) {
    const slug = item.slug?.trim()
    const title = item.title?.replace(/\s+/g, ' ').trim()
    if (!slug || !title || title.length < 4 || !Number.isFinite(item.articleId) || item.articleId <= 0) {
      continue
    }

    if (!isValidRecentAIHitTimestamp(item.lastHitAt, now)) {
      continue
    }

    const nextItem: RecentAIHitArticle = {
      ...item,
      slug,
      title,
      summary: item.summary?.replace(/\s+/g, ' ').trim() || '',
      source: item.source?.replace(/\s+/g, ' ').trim() || undefined,
      sourceOrg: item.sourceOrg?.replace(/\s+/g, ' ').trim() || undefined,
      topic: item.topic?.replace(/\s+/g, ' ').trim() || undefined,
    }

    const existing = deduped.get(slug)
    if (!existing || nextItem.lastHitAt > existing.lastHitAt) {
      deduped.set(slug, nextItem)
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => right.lastHitAt.localeCompare(left.lastHitAt))
    .slice(0, RECENT_AI_HIT_ARTICLE_LIMIT)
}

export function mergeRecentAIHitArticles(
  existing: RecentAIHitArticle[],
  next: RecentAIHitArticle,
): RecentAIHitArticle[] {
  return sanitizeRecentAIHitArticles([next, ...existing.filter((item) => item.slug !== next.slug)])
}

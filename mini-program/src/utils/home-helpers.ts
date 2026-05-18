import { formatSourceLabel, getKnowledgeDisplayTitle } from '@/utils/knowledge-format'
import type { RecentAIHitArticle } from '@/stores/knowledge'

export interface RecentKnowledgeItem {
  slug: string
  title: string
  sourceLabel: string
  updatedAtLabel: string
}

export interface HomeRecentAiHitItem extends RecentAIHitArticle {
  sourceLabel: string
  topicLabel: string
  hitLabel: string
}

export interface HomeRecentAiTopic {
  topic: string
  displayName: string
  count: number
  sample: HomeRecentAiHitItem
}

export interface HomeRecentAiSource {
  source: string
  displayName: string
  count: number
  sample: HomeRecentAiHitItem
}

export function formatRecentHitTime(value?: string): string {
  if (!value) return '刚刚命中'

  const diffMs = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diffMs) || diffMs < 0) return '刚刚命中'

  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return '刚刚命中'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前命中`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} 小时前命中`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} 天前命中`
}

export function buildRecentAIHitTopics(items: HomeRecentAiHitItem[]): HomeRecentAiTopic[] {
  const topicMap = new Map<string, HomeRecentAiTopic>()

  items.forEach((item) => {
    const displayName = (item.topic || '').trim()
    if (!displayName) return

    const key = displayName.toLowerCase()
    const existing = topicMap.get(key)
    if (existing) {
      existing.count += 1
      return
    }

    topicMap.set(key, {
      topic: item.topic || displayName,
      displayName,
      count: 1,
      sample: item,
    })
  })

  return Array.from(topicMap.values())
    .sort((left, right) => right.count - left.count || left.displayName.localeCompare(right.displayName, 'zh-CN'))
    .slice(0, 3)
}

export function buildRecentAIHitSources(items: HomeRecentAiHitItem[]): HomeRecentAiSource[] {
  const sourceMap = new Map<string, HomeRecentAiSource>()

  items.forEach((item) => {
    const rawSource = (item.sourceOrg || item.source || '').trim()
    const displayName = formatSourceLabel(rawSource)
    if (!displayName) return

    const key = displayName.toLowerCase()
    const existing = sourceMap.get(key)
    if (existing) {
      existing.count += 1
      return
    }

    sourceMap.set(key, {
      source: rawSource || displayName,
      displayName,
      count: 1,
      sample: item,
    })
  })

  return Array.from(sourceMap.values())
    .sort((left, right) => right.count - left.count || left.displayName.localeCompare(right.displayName, 'zh-CN'))
    .slice(0, 3)
}

export function parseStoredRecentAiHits(stored: unknown[]): HomeRecentAiHitItem[] {
  if (!Array.isArray(stored)) return []

  return stored
    .filter((item: any) => item?.slug && item?.title && Number.isFinite(item?.articleId))
    .slice(0, 2)
    .map((item: any) => ({
      articleId: Number(item.articleId),
      slug: item.slug || '',
      title: getKnowledgeDisplayTitle({
        title: item.title,
        topic: item.topic,
        stage: item.stage,
      }),
      summary: item.summary || '',
      source: item.source,
      sourceOrg: item.sourceOrg,
      topic: item.topic,
      stage: item.stage,
      publishedAt: item.publishedAt,
      sourceUpdatedAt: item.sourceUpdatedAt,
      createdAt: item.createdAt || new Date().toISOString(),
      lastHitAt: item.lastHitAt || new Date().toISOString(),
      sourceLabel: formatSourceLabel(item.sourceOrg || item.source || '权威来源'),
      topicLabel: item.topic?.trim() || '',
      hitLabel: formatRecentHitTime(item.lastHitAt),
      sourceLanguage: item.sourceLanguage === 'zh' || item.sourceLanguage === 'en' ? item.sourceLanguage : undefined,
      sourceLocale: item.sourceLocale,
      trigger: item.trigger === 'hit_card' || item.trigger === 'knowledge_action' ? item.trigger : undefined,
      matchReason: item.matchReason === 'entry_meta'
        || item.matchReason === 'source_url'
        || item.matchReason === 'source_title'
        || item.matchReason === 'source_keyword'
        ? item.matchReason
        : undefined,
      originEntrySource: item.originEntrySource,
      originReportId: item.originReportId,
      qaId: item.qaId,
    }))
}

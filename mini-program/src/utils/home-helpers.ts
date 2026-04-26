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

export interface StageRecommendationItem {
  key: string
  title: string
  desc: string
  keyword: string
  stage: string | null
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

export function getStageRecommendationItems(week?: number | null): StageRecommendationItem[] {
  if (!week) {
    return [
      {
        key: 'start-stage',
        title: '先补当前阶段',
        desc: '先确认自己处于备孕、孕期还是产后，再去读对应资料更省时间。',
        keyword: '孕期 阶段 产检 新手指南',
        stage: null,
      },
      {
        key: 'authority-start',
        title: '先看权威来源',
        desc: '从中国政府网、国家卫健委和中国疾控的公开资料开始，减少经验帖干扰。',
        keyword: '国家卫健委 中国疾控 孕产 指南',
        stage: null,
      },
      {
        key: 'newborn-start',
        title: '新生儿常见问题',
        desc: '提前熟悉喂养、黄疸、疫苗和睡眠主题，后面进入对应阶段会更快。',
        keyword: '新生儿 喂养 黄疸 疫苗 睡眠',
        stage: 'newborn',
      },
    ]
  }

  if (week <= 12) {
    return [
      { key: 'early-risk', title: '孕早期风险信号', desc: '优先读出血、腹痛、孕吐和何时需要尽快线下就医。', keyword: '孕早期 出血 腹痛 孕吐 就医', stage: 'first-trimester' },
      { key: 'early-checkup', title: '叶酸与首次产检', desc: '先把叶酸补充、建档和初次产检节点看清楚。', keyword: '叶酸 建档 初次产检 早孕', stage: 'first-trimester' },
      { key: 'early-lifestyle', title: '饮食和生活方式', desc: '重点看忌口、补剂、休息和早孕期日常注意事项。', keyword: '孕早期 饮食 补剂 休息 注意事项', stage: 'first-trimester' },
    ]
  }

  if (week <= 27) {
    return [
      { key: 'mid-checkup', title: '产检节点与报告', desc: '把中期检查、常见指标和复查时机串起来看。', keyword: '孕中期 产检 报告 糖耐 B超', stage: 'second-trimester' },
      { key: 'mid-nutrition', title: '体重与营养安排', desc: '优先看营养补充、体重管理和运动建议。', keyword: '孕中期 营养 体重 运动', stage: 'second-trimester' },
      { key: 'mid-fetal-movement', title: '胎动与身体变化', desc: '先把胎动观察、宫缩区别和异常信号理顺。', keyword: '胎动 宫缩 孕中期 异常信号', stage: 'second-trimester' },
    ]
  }

  return [
    { key: 'late-delivery', title: '临近分娩准备', desc: '优先读入院信号、待产包和家人分工。', keyword: '孕晚期 入院信号 待产包 分娩准备', stage: 'third-trimester' },
    { key: 'late-breastfeeding', title: '哺乳与新生儿护理', desc: '先把产后喂养、皮肤接触和新生儿护理的基础内容看一遍。', keyword: '哺乳 新生儿护理 产后 喂养', stage: 'third-trimester' },
    { key: 'late-warning', title: '宫缩与异常情况', desc: '重点区分规律宫缩、破水和需要尽快处理的异常信号。', keyword: '孕晚期 宫缩 破水 胎动 异常', stage: 'third-trimester' },
  ]
}

export function getFocusItems(week?: number | null) {
  if (!week) {
    return [
      { index: '01', title: '先查权威知识', desc: '优先阅读中国权威来源与国际指南，避免先被经验帖带偏。' },
      { index: '02', title: '再看孕周安排', desc: '先浏览当前阶段重点，不登录也能看，确定需要保存再进入登录。' },
      { index: '03', title: '最后完善孕周', desc: '只补一个孕周信息，就能让日历、首页和提醒更贴合当前阶段。' },
    ]
  }

  if (week <= 12) {
    return [
      { index: '01', title: '先确认本周风险点', desc: '重点看孕吐、出血、叶酸、早孕检查等高频主题。' },
      { index: '02', title: '安排本周待办', desc: '把产检、补剂和需要观察的身体变化整理进本周清单。' },
      { index: '03', title: '补齐阶段档案', desc: '保存孕周后，首页和日历会更准确地贴合你当前这一阶段。' },
    ]
  }

  if (week <= 27) {
    return [
      { index: '01', title: '对照阶段发育重点', desc: '优先看产检节点、体重管理、胎动和营养主题。' },
      { index: '02', title: '把待办拆成可执行项', desc: '把预约、复查、补充记录拆成本周能完成的小动作。' },
      { index: '03', title: '留下本周记录', desc: '把异常感受和产检结果写下来，后面复盘更省力。' },
    ]
  }

  return [
    { index: '01', title: '优先看临近分娩主题', desc: '先查看宫缩、入院准备、疫苗、哺乳和新生儿护理等主题。' },
    { index: '02', title: '完成临产前准备', desc: '把待产包、产检复查、就诊路线和家人分工放进本周待办。' },
    { index: '03', title: '把变化及时记下来', desc: '出现胎动变化、宫缩频率或医生新建议时，尽快记录。' },
  ]
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

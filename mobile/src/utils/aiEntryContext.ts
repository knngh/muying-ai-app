import type { LifecycleStageKey } from './stage'

type ChatContextRecord = Record<string, string | number | boolean | null>

type WeeklyReportContextInput = {
  reportId: string
  stageLabel: string
  highlight: string
  highlightIndex: number
  stageKey: LifecycleStageKey
}

type KnowledgeDetailContextInput = {
  slug: string
  title: string
  sourceOrg?: string | null
  topic?: string | null
  summary?: string | null
  stageKey: LifecycleStageKey
}

export function buildHomeChatContext(stageKey: LifecycleStageKey): ChatContextRecord {
  return {
    entrySource: 'home_suggested_question',
    stage: stageKey,
  }
}

export function buildWeeklyReportChatContext(input: WeeklyReportContextInput): ChatContextRecord {
  return {
    entrySource: 'weekly_report',
    stage: input.stageKey,
    reportId: input.reportId,
    reportStageLabel: input.stageLabel,
    reportHighlight: input.highlight.replace(/\s+/g, ' ').trim().slice(0, 180),
    reportHighlightIndex: input.highlightIndex + 1,
  }
}

export function buildKnowledgeDetailChatContext(input: KnowledgeDetailContextInput): ChatContextRecord {
  return {
    entrySource: 'knowledge_detail',
    stage: input.stageKey,
    articleSlug: input.slug,
    articleTitle: input.title.replace(/\s+/g, ' ').trim().slice(0, 120),
    articleSourceOrg: input.sourceOrg?.replace(/\s+/g, ' ').trim().slice(0, 80) || null,
    articleTopic: input.topic?.replace(/\s+/g, ' ').trim().slice(0, 60) || null,
    articleSummary: input.summary?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180) || null,
  }
}

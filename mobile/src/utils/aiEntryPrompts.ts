import type { LifecycleStageKey } from './stage'
import { getSuggestedQuestion as getStageSuggestedQuestion } from './chatPrompts'

type WeeklyReportPromptInput = {
  stageLabel: string
  title: string
}

type KnowledgeDetailPromptInput = {
  title: string
  summary?: string | null
  sourceOrg?: string | null
  topic?: string | null
}

function cleanText(value?: string | null): string {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function quoteSnippet(value: string, maxLength: number): string {
  const normalized = cleanText(value)
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
}

export function buildHomeSuggestedQuestion(stageKey: LifecycleStageKey): string {
  return getStageSuggestedQuestion(stageKey)
}

export function buildWeeklyReportQuestion(report: WeeklyReportPromptInput, highlight: string): string {
  const normalizedHighlight = quoteSnippet(highlight, 140)
  return [
    `我在${report.stageLabel}的周报里看到这条提醒：“${normalizedHighlight}”。`,
    '请结合当前阶段帮我解释这句话最值得关注的点。',
    '如果要落实到接下来几天，请按“观察重点、具体安排、何时需要再处理”来梳理。',
  ].join('')
}

export function buildKnowledgeDetailQuestion(input: KnowledgeDetailPromptInput): string {
  const title = quoteSnippet(input.title, 60) || '这篇权威内容'
  const summary = quoteSnippet(input.summary || '', 140)
  const sourceText = cleanText(input.sourceOrg) ? `来源机构是${cleanText(input.sourceOrg)}。` : ''
  const topicText = cleanText(input.topic) ? `主题是${cleanText(input.topic)}。` : ''

  if (summary) {
    return [
      `我正在看一篇关于“${title}”的权威内容。`,
      sourceText,
      topicText,
      `摘要里提到：“${summary}”。`,
      '请结合当前阶段帮我解释这篇内容最值得关注的点，以及我接下来该怎么理解和安排？',
    ].filter(Boolean).join('')
  }

  return [
    `我正在看一篇关于“${title}”的权威内容。`,
    sourceText,
    topicText,
    '请结合当前阶段帮我提炼这篇文章最值得关注的点，以及我接下来该怎么理解和安排？',
  ].filter(Boolean).join('')
}

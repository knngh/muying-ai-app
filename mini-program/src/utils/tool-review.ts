import type { ToolAIReviewResponse } from '../api/modules'
import type { LocalToolRecord } from './tool-records'
import { historyDate, historyDetails, historyTitle } from './tool-history'

export const MAX_REVIEW_RECORDS = 20
export const MAX_SAVED_REVIEWS = 10
export type ReviewOrigin = 'local' | 'server-rules' | 'ai'
export interface ReviewInputRecord { id: string; updatedAt: string; date: string; content: string }
export function selectReviewRecords(inputs: ReviewInputRecord[], requestedIds: string[]) {
  const available = new Set(inputs.map(item => item.id))
  const ids = Array.from(new Set(requestedIds)).filter(id => available.has(id))
  return { ids: ids.slice(0, MAX_REVIEW_RECORDS), total: ids.length }
}
export interface SavedToolReview {
  id: string
  createdAt: string
  stage: string
  records: ReviewInputRecord[]
  origin: ReviewOrigin
  result: ToolAIReviewResponse
}

export function reviewInputs(records: LocalToolRecord[]): ReviewInputRecord[] {
  return records.map(record => {
    const details = historyDetails(record).map(field => `${field.label}：${field.value}`).join('；')
    const text = (details || historyTitle(record)).replace(/\s+/g, ' ').trim()
    return { id: record.id, updatedAt: record.updatedAt, date: historyDate(record), content: text.length > 300 ? `${text.slice(0, 299)}…` : text }
  }).filter(record => record.content)
}

export function localToolReview(label: string, records: ReviewInputRecord[]): ToolAIReviewResponse {
  const dates = records.map(record => record.date.slice(0, 10)).filter(Boolean).sort()
  return {
    source: 'rules', title: `${label}回顾`,
    summary: `本次整理 ${records.length} 条已选记录${dates.length ? `，记录日期为 ${dates[0]} 至 ${dates[dates.length - 1]}` : ''}。以下摘录按所选顺序展示。`,
    highlights: records.slice(0, 3).map(record => `${record.date || '未标日期'} · ${record.content}`),
    nextSteps: ['可回到历史记录查看完整原文，再补充遗漏的信息。'],
    focus: '已选记录摘要', model: null, provider: null,
    disclaimer: '本机固定模板整理，不是医疗建议；原始记录仍以历史记录为准。',
  }
}

export function reviewMatches(review: SavedToolReview, records: ReviewInputRecord[]): boolean {
  const current = new Map(records.map(record => [record.id, record]))
  return review.records.every(record => JSON.stringify(current.get(record.id)) === JSON.stringify(record))
}

export function reviewSourceLabel(origin: ReviewOrigin): string {
  return { local: '本机摘要', 'server-rules': '服务端规则摘要', ai: 'AI 生成内容' }[origin]
}

export function isToolReviewResponse(value: unknown): value is ToolAIReviewResponse {
  if (!value || typeof value !== 'object') return false
  const r = value as ToolAIReviewResponse
  return (r.source === 'ai' || r.source === 'rules')
    && ['title', 'summary', 'focus', 'disclaimer'].every(key => typeof r[key as keyof ToolAIReviewResponse] === 'string')
    && [r.highlights, r.nextSteps].every(list => Array.isArray(list) && list.every(item => typeof item === 'string'))
    && [r.model, r.provider].every(item => item === null || typeof item === 'string')
}

function isSavedReview(value: unknown): value is SavedToolReview {
  if (!value || typeof value !== 'object') return false
  const item = value as SavedToolReview
  return typeof item.id === 'string' && typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt))
    && typeof item.stage === 'string' && ['local', 'server-rules', 'ai'].includes(item.origin)
    && isToolReviewResponse(item.result) && (item.origin === 'ai') === (item.result.source === 'ai')
    && Array.isArray(item.records) && item.records.length > 0 && item.records.length <= MAX_REVIEW_RECORDS
    && item.records.every(record => record && ['id', 'updatedAt', 'date', 'content'].every(key => typeof record[key as keyof ReviewInputRecord] === 'string'))
}

const storageKey = (owner: string, toolId: string) => `beihu:tool-reviews:v1:${owner}:${toolId}`
export function readSavedReviews(owner: string, toolId: string, records: ReviewInputRecord[]): SavedToolReview[] {
  const stored: unknown = uni.getStorageSync(storageKey(owner, toolId))
  if (!Array.isArray(stored)) return []
  const valid = stored.filter(isSavedReview).filter(item => reviewMatches(item, records))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, MAX_SAVED_REVIEWS)
  // Removing or changing a source record also clears derived, saved prose.
  if (valid.length !== stored.length) writeSavedReviews(owner, toolId, valid)
  return valid
}
export function writeSavedReviews(owner: string, toolId: string, reviews: SavedToolReview[]): void {
  uni.setStorageSync(storageKey(owner, toolId), reviews.slice(0, MAX_SAVED_REVIEWS))
}

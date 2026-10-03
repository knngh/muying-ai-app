export interface ContractionHistoryInput {
  startAt?: unknown
  endAt?: unknown
  durationSeconds?: unknown
}

export interface ContractionHistoryItem {
  startAt: string
  endAt: string
  durationSeconds: number
  intervalSeconds: number | null
}

function timestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const result = Date.parse(value)
  return Number.isFinite(result) ? result : null
}

export function contractionIntervalSeconds(startAt: unknown, previousStartAt: unknown): number | null {
  const current = timestamp(startAt)
  const previous = timestamp(previousStartAt)
  if (current === null || previous === null || current <= previous) return null
  return Math.round((current - previous) / 1000)
}

export function summarizeContractionHistory(records: ContractionHistoryInput[]): ContractionHistoryItem[] {
  const valid = records
    .map(record => {
      const startAt = typeof record.startAt === 'string' ? record.startAt : ''
      const endAt = typeof record.endAt === 'string' ? record.endAt : ''
      const start = timestamp(startAt)
      const end = timestamp(endAt)
      const duration = typeof record.durationSeconds === 'number' && Number.isFinite(record.durationSeconds) ? Math.round(record.durationSeconds) : null
      return start !== null && end !== null && end >= start && duration !== null && duration >= 0
        ? { startAt, endAt, durationSeconds: duration, start }
        : null
    })
    .filter((item): item is { startAt: string; endAt: string; durationSeconds: number; start: number } => Boolean(item))
    .sort((a, b) => a.start - b.start)
  return valid.map((item, index) => ({
    startAt: item.startAt,
    endAt: item.endAt,
    durationSeconds: item.durationSeconds,
    intervalSeconds: index ? Math.round((item.start - valid[index - 1].start) / 1000) : null,
  })).reverse()
}

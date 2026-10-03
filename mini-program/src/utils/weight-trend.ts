import type { LocalToolRecord } from './tool-records'

export interface WeightPoint { id: string; date: string; day: number; value: number }
const DAY = 86400000

export function weightPoints(records: LocalToolRecord[]): WeightPoint[] {
  return records.flatMap(record => {
    const { value, measuredAt } = record.payload
    if (record.toolId !== 'weight' || typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 300
      || typeof measuredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(measuredAt)) return []
    const date = measuredAt.slice(0, 10)
    const timestamp = Date.parse(`${date}T00:00:00Z`)
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) return []
    return [{ id: record.id, date, day: timestamp / DAY, value, savedAt: Date.parse(record.createdAt) || 0 }]
  }).sort((a, b) => a.day - b.day || a.savedAt - b.savedAt).slice(-12)
}

// Fractions use elapsed calendar days; same-day readings share an x position.
export function weightChartLayout(points: WeightPoint[]) {
  if (!points.length) return { lower: 0, upper: 1, ticks: [], points: [] }
  const values = points.map(point => point.value)
  const min = Math.min(...values), max = Math.max(...values)
  const padding = Math.max((max - min) * .2, .4)
  const lower = Math.floor((min - padding) * 10) / 10
  const upper = Math.ceil((max + padding) * 10) / 10
  const first = points[0].day, span = points[points.length - 1].day - first
  return {
    lower, upper,
    ticks: Array.from({ length: 4 }, (_, i) => upper - i * (upper - lower) / 3),
    points: points.map(point => ({ ...point, x: span ? (point.day - first) / span : .5, y: (upper - point.value) / (upper - lower) })),
  }
}

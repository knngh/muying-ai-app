import { contractionIntervalSeconds, summarizeContractionHistory } from '../mini-program/src/utils/contraction-sessions'

it('calculates the interval between consecutive contraction starts', () => {
  expect(contractionIntervalSeconds('2026-09-24T08:10:00.000Z', '2026-09-24T08:05:30.000Z')).toBe(270)
  expect(contractionIntervalSeconds('2026-09-24T08:05:00.000Z', '2026-09-24T08:05:30.000Z')).toBeNull()
})

it('returns the newest valid contraction first and keeps the first interval empty', () => {
  const result = summarizeContractionHistory([
    { startAt: '2026-09-24T08:10:00.000Z', endAt: '2026-09-24T08:10:30.000Z', durationSeconds: 30 },
    { startAt: '2026-09-24T08:05:00.000Z', endAt: '2026-09-24T08:05:20.000Z', durationSeconds: 20 },
    { startAt: 'bad', endAt: 'bad', durationSeconds: 3 },
  ])
  expect(result).toEqual([
    { startAt: '2026-09-24T08:10:00.000Z', endAt: '2026-09-24T08:10:30.000Z', durationSeconds: 30, intervalSeconds: 300 },
    { startAt: '2026-09-24T08:05:00.000Z', endAt: '2026-09-24T08:05:20.000Z', durationSeconds: 20, intervalSeconds: null },
  ])
})

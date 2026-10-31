import { contractionIntervalSeconds, summarizeContractionHistory, readContractionStart, writeContractionStart } from '../mini-program/src/utils/contraction-sessions'

it('restores contraction timers only for their owner and preserves guest legacy timers', () => {
  const storage = new Map<string, unknown>()
  ;(globalThis as unknown as { uni: unknown }).uni = { getStorageSync: (key: string) => storage.get(key) || '', setStorageSync: (key: string, value: unknown) => storage.set(key, value), removeStorageSync: (key: string) => storage.delete(key) }
  const start = '2026-09-24T08:00:00.000Z'
  storage.set('beihu:contraction-start', start)
  storage.set('token', 'test'); storage.set('user', { id: '123' })
  expect(readContractionStart()).toBeNull()
  writeContractionStart(start)
  storage.set('user', { id: '456' })
  expect(readContractionStart()).toBeNull()
  writeContractionStart(null)
  storage.set('user', { id: '123' })
  expect(readContractionStart()).toBe(start)
  storage.delete('token'); storage.delete('user')
  expect(readContractionStart()).toBe(start)
  writeContractionStart(null)
  expect(readContractionStart()).toBeNull()
})

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

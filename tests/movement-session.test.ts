import { clearMovementSession, movementElapsedSeconds, readMovementSession, writeMovementSession } from '../mini-program/src/utils/movement-session'

const storage = new Map<string, unknown>()
const store = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: unknown) => { storage.set(key, value) },
  removeStorageSync: (key: string) => { storage.delete(key) },
};
(globalThis as unknown as { uni: unknown }).uni = store

beforeEach(() => { storage.clear() })

it('persists the selected movement mode and migrates legacy taps', () => {
  storage.set('beihu:movement-session:v1', ['2026-09-24T08:00:00.000Z'])
  expect(readMovementSession()).toEqual({ taps: ['2026-09-24T08:00:00.000Z'], mode: 'free', startedAt: '2026-09-24T08:00:00.000Z' })
  writeMovementSession({ taps: ['2026-09-24T08:00:00.000Z'], mode: 'one_hour_morning', startedAt: '2026-09-24T08:00:00.000Z' })
  expect(readMovementSession().mode).toBe('one_hour_morning')
  clearMovementSession()
  expect(readMovementSession().taps).toEqual([])
})

it('calculates actual session duration without extrapolating counts', () => {
  expect(movementElapsedSeconds('2026-09-24T08:00:00.000Z', '2026-09-24T08:22:30.000Z')).toBe(1350)
  expect(movementElapsedSeconds('2026-09-24T08:22:30.000Z', '2026-09-24T08:00:00.000Z')).toBe(0)
})

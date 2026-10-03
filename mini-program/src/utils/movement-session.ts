export type MovementMode = 'free' | 'one_hour_morning' | 'one_hour_midday' | 'one_hour_evening'

export const MOVEMENT_MODES: Array<{ value: MovementMode; label: string }> = [
  { value: 'free', label: '自由记录' },
  { value: 'one_hour_morning', label: '早间 1 小时' },
  { value: 'one_hour_midday', label: '中午 1 小时' },
  { value: 'one_hour_evening', label: '晚间 1 小时' },
]

export interface MovementDraft {
  taps: string[]
  mode: MovementMode
  startedAt: string | null
}

const SESSION_KEY = 'beihu:movement-session:v2'
const LEGACY_KEY = 'beihu:movement-session:v1'

function validTap(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function validMode(value: unknown): value is MovementMode {
  return MOVEMENT_MODES.some(item => item.value === value)
}

export function readMovementSession(): MovementDraft {
  const stored: unknown = uni.getStorageSync(SESSION_KEY)
  if (stored && typeof stored === 'object') {
    const value = stored as Partial<MovementDraft>
    const taps = Array.isArray(value.taps) ? value.taps.filter(validTap).slice(0, 10000) : []
    return { taps, mode: validMode(value.mode) ? value.mode : 'free', startedAt: validTap(value.startedAt) ? value.startedAt : taps[0] || null }
  }
  const legacy: unknown = uni.getStorageSync(LEGACY_KEY)
  const taps = Array.isArray(legacy) ? legacy.filter(validTap).slice(0, 10000) : []
  return { taps, mode: 'free', startedAt: taps[0] || null }
}

export function writeMovementSession(draft: MovementDraft): void {
  const taps = draft.taps.filter(validTap).slice(-10000)
  if (!taps.length) {
    clearMovementSession()
    return
  }
  uni.setStorageSync(SESSION_KEY, { taps, mode: validMode(draft.mode) ? draft.mode : 'free', startedAt: validTap(draft.startedAt) ? draft.startedAt : taps[0] })
}

export function clearMovementSession(): void {
  uni.removeStorageSync(SESSION_KEY)
  uni.removeStorageSync(LEGACY_KEY)
}

export function movementModeLabel(mode: unknown): string {
  return MOVEMENT_MODES.find(item => item.value === mode)?.label || '自由记录'
}

export function movementElapsedSeconds(startedAt: unknown, endedAt: unknown = new Date().toISOString()): number {
  if (!validTap(startedAt) || !validTap(endedAt)) return 0
  return Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000))
}

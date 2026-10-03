const MOVEMENT_KEY = 'beihu:movement-session:v1'
export function readMovementTaps(): string[] {
  const value: unknown = uni.getStorageSync(MOVEMENT_KEY)
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Number.isFinite(Date.parse(item))).slice(0, 10000) : []
}
export function writeMovementTaps(taps: string[]) {
  if (taps.length) uni.setStorageSync(MOVEMENT_KEY, taps)
  else uni.removeStorageSync(MOVEMENT_KEY)
}

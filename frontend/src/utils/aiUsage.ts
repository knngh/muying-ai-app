// 免费额度本地计数：后端不提供查询接口（不动 beihu.me 原则），本地按天计数 + 429 权威兜底。
// 跨设备/清缓存会偏差（偏保守），实际拦截以后端 quotaCheckMiddleware 为准。
const KEY_PREFIX = 'beihu:aiUsage:'

function todayKey(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function getTodayAiUsage(): number {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + todayKey())
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
  } catch {
    return 0
  }
}

/** 成功获得一次回答后调用，返回今日累计次数 */
export function recordAiUsage(): number {
  const next = getTodayAiUsage() + 1
  try {
    window.localStorage.setItem(KEY_PREFIX + todayKey(), String(next))
  } catch {
    // localStorage 不可用（隐私模式等）时只返回计数
  }
  return next
}

/** 判断发送失败是否为免费额度用尽（后端 429，code 4003） */
export function isAiQuotaExhaustedError(error: unknown): boolean {
  const err = error as {
    response?: { status?: number; data?: { code?: number } }
    message?: string
  }
  if (err?.response?.status === 429 || err?.response?.data?.code === 4003) return true
  return typeof err?.message === 'string' && err.message.includes('今日免费额度已用完')
}

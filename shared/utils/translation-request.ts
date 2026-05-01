import type { TranslationPendingError } from '../types'

export const AUTHORITY_TRANSLATION_REQUEST_TIMEOUT_MS = 18000

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function buildTranslationPendingError(
  retryAfterMs?: number,
  message = '中文辅助阅读正在准备中，请稍后查看',
): TranslationPendingError {
  const error = new Error(message) as TranslationPendingError
  error.translationPending = true
  error.retryAfterMs = retryAfterMs
  return error
}

export function isTranslationPendingError(error: unknown): error is TranslationPendingError {
  return Boolean(error && typeof error === 'object' && 'translationPending' in error)
}

export function getTranslationRetryDelay(retryAfterMs?: number, attempt = 0, maxDelayMs = 10000): number {
  const baseDelay = retryAfterMs || 2000
  return Math.min(baseDelay * Math.pow(1.5, attempt), maxDelayMs)
}

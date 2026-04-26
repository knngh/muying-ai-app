import {
  AUTHORITY_TRANSLATION_REQUEST_TIMEOUT_MS,
  buildTranslationPendingError,
  getTranslationRetryDelay,
  isTranslationPendingError,
  sleep,
} from '../shared/utils/translation-request'

describe('translation request helpers', () => {
  test('exports the shared translation timeout budget', () => {
    expect(AUTHORITY_TRANSLATION_REQUEST_TIMEOUT_MS).toBe(45000)
  })

  test('builds a translation pending error with retry metadata', () => {
    const error = buildTranslationPendingError(3200)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('中文辅助阅读正在准备中，请稍后查看')
    expect(error.translationPending).toBe(true)
    expect(error.retryAfterMs).toBe(3200)
    expect(isTranslationPendingError(error)).toBe(true)
  })

  test('supports overriding the pending error message', () => {
    const error = buildTranslationPendingError(undefined, '请一分钟后再试')

    expect(error.message).toBe('请一分钟后再试')
    expect(error.retryAfterMs).toBeUndefined()
    expect(isTranslationPendingError(error)).toBe(true)
  })

  test('identifies non-pending errors safely', () => {
    expect(isTranslationPendingError(new Error('plain error'))).toBe(false)
    expect(isTranslationPendingError({ translationPending: false })).toBe(true)
    expect(isTranslationPendingError(null)).toBe(false)
    expect(isTranslationPendingError('error')).toBe(false)
  })

  test('applies exponential retry backoff and caps the delay', () => {
    expect(getTranslationRetryDelay(undefined, 0)).toBe(2000)
    expect(getTranslationRetryDelay(3000, 1)).toBe(4500)
    expect(getTranslationRetryDelay(9000, 2)).toBe(10000)
    expect(getTranslationRetryDelay(12000, 0, 5000)).toBe(5000)
  })

  test('sleep resolves after the requested delay', async () => {
    jest.useFakeTimers()

    const resolved = jest.fn()
    const pending = sleep(250)
    pending.then(resolved)

    await Promise.resolve()
    expect(resolved).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(249)
    expect(resolved).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(1)
    await pending
    expect(resolved).toHaveBeenCalledTimes(1)

    jest.useRealTimers()
  })
})

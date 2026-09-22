import { WECHAT_SUBSCRIBE_ENABLED, WECHAT_SUBSCRIBE_TEMPLATE_ID } from '@/config/features'
import { wechatNotificationApi } from '@/api/modules'
import { reportOwner } from './report-drafts'

export type WechatSubscribeResult = 'accept' | 'reject' | 'ban' | 'filter' | 'unsupported'

interface SubscribeApi {
  requestSubscribeMessage?: (options: {
    tmplIds: string[]
    success?: (result: Record<string, unknown>) => void
    fail?: () => void
    complete?: () => void
  }) => void
}

/**
 * The uni typings do not expose this WeChat-only API on every target. Keep the
 * capability check here so H5/Alipay builds simply keep their local reminder.
 */
export function requestWechatReminderSubscription(templateId: string): Promise<WechatSubscribeResult> {
  if (!templateId) return Promise.resolve('unsupported')
  const subscribeApi = uni as unknown as SubscribeApi
  if (typeof subscribeApi.requestSubscribeMessage !== 'function') return Promise.resolve('unsupported')

  return new Promise(resolve => {
    let settled = false
    const finish = (result: WechatSubscribeResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }
    try {
      const requestSubscribeMessage = subscribeApi.requestSubscribeMessage
      if (typeof requestSubscribeMessage !== 'function') { finish('unsupported'); return }
      requestSubscribeMessage({
        tmplIds: [templateId],
        success: result => {
          const value = result?.[templateId]
          if (value === 'accept' || value === 'reject' || value === 'ban' || value === 'filter') finish(value)
          else finish('reject')
        },
        fail: () => finish('unsupported'),
        complete: () => { if (!settled) finish('unsupported') },
      })
    } catch {
      finish('unsupported')
    }
  })
}

/** Cancel a queued delivery without making local reminder operations depend on
 * the network. The caller can still await this when a reschedule needs ordering. */
export async function cancelWechatReminderRemote(clientReminderId: string, owner = reportOwner()): Promise<void> {
  if (!WECHAT_SUBSCRIBE_ENABLED || !WECHAT_SUBSCRIBE_TEMPLATE_ID || owner === 'guest' || owner !== reportOwner()) return
  try {
    await wechatNotificationApi.cancelReminder(clientReminderId)
  } catch {
    // Local state is authoritative for the device. A later save with the same
    // id is idempotent and will repair the server queue when connectivity returns.
  }
}

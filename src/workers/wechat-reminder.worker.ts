import { env } from '../config/env';
import { getWechatSubscribeConfig, } from '../services/wechat-reminder.service';
import { processDueWechatReminders } from '../services/wechat-reminder-delivery.service';

export function startWechatReminderWorker(): NodeJS.Timeout | null {
  const config = getWechatSubscribeConfig();
  if (!config.enabled || !config.configured) {
    console.log('[Wechat Reminder] worker disabled: missing opt-in or template configuration');
    return null;
  }

  const intervalMs = env.WECHAT_REMINDER_INTERVAL_SECONDS * 1000;
  const tick = async () => {
    try {
      const result = await processDueWechatReminders();
      if (result.scanned || result.recovered) {
        console.log('[Wechat Reminder] tick:', JSON.stringify({
          scanned: result.scanned,
          sent: result.sent,
          retried: result.retried,
          failed: result.failed,
          recovered: result.recovered,
        }));
      }
    } catch (error) {
      console.error('[Wechat Reminder] tick failed:', error instanceof Error ? error.message : 'unknown error');
    }
  };
  const timer = setInterval(() => { void tick(); }, intervalMs);
  timer.unref();
  void tick();
  return timer;
}

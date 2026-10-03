import { startWechatReminderWorker } from '../workers/wechat-reminder.worker';

const timer = startWechatReminderWorker();
if (!timer) process.exit(0);

const shutdown = () => {
  clearInterval(timer);
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

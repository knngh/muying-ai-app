import { syncAllAuthoritySources } from '../services/authority-sync.service';

const intervalMinutes = Number(process.env.AUTHORITY_SYNC_INTERVAL_MINUTES || 360);
const mode = (process.env.AUTHORITY_SYNC_MODE || 'incremental') as 'full' | 'incremental';

async function runOnce() {
  const result = await syncAllAuthoritySources(mode);
  console.log('[Authority Worker] sync result:', JSON.stringify(result));
}

async function main() {
  await runOnce();

  if (process.env.AUTHORITY_SYNC_RUN_ONCE === 'true') {
    return;
  }

  setInterval(() => {
    void runOnce().catch((error) => {
      console.error('[Authority Worker] periodic sync failed:', error);
    });
  }, intervalMinutes * 60 * 1000);
}

main().catch((error) => {
  console.error('[Authority Worker] failed:', error);
  process.exit(1);
});

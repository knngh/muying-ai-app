import '../config/env';
import { syncAllAuthoritySources } from '../services/authority-sync.service';
import { warmPublishedAuthorityTranslations } from '../services/authority-translation.service';

const intervalMinutes = Number(process.env.AUTHORITY_SYNC_INTERVAL_MINUTES || 360);
const mode = (process.env.AUTHORITY_SYNC_MODE || 'incremental') as 'full' | 'incremental';
const translationSyncEnabled = !/^(0|false|off)$/i.test(process.env.AUTHORITY_TRANSLATION_SYNC_ENABLED || 'true');
const translationWarmupIntervalMinutes = Math.max(
  5,
  Number(process.env.AUTHORITY_TRANSLATION_WARMUP_INTERVAL_MINUTES || 15),
);

let translationWarmupInProgress = false;

async function runTranslationWarmup(phase: 'startup' | 'after_sync' | 'interval') {
  if (!translationSyncEnabled) {
    console.log('[Authority Worker] translation warmup skipped: AUTHORITY_TRANSLATION_SYNC_ENABLED=false');
    return;
  }

  if (translationWarmupInProgress) {
    console.log(`[Authority Worker] translation warmup skipped (${phase}): previous batch still running`);
    return;
  }

  translationWarmupInProgress = true;
  try {
    const translationResult = await warmPublishedAuthorityTranslations();
    console.log(`[Authority Worker] translation warmup result (${phase}):`, JSON.stringify(translationResult));
  } catch (error) {
    console.error(`[Authority Worker] translation warmup failed (${phase}):`, error);
  } finally {
    translationWarmupInProgress = false;
  }
}

async function runAuthoritySyncCycle() {
  try {
    const result = await syncAllAuthoritySources(mode);
    console.log('[Authority Worker] sync result:', JSON.stringify(result));
  } catch (error) {
    console.error('[Authority Worker] sync failed, continuing with translation warmup from current snapshot:', error);
  }

  await runTranslationWarmup('after_sync');
}

async function main() {
  await runTranslationWarmup('startup');

  if (process.env.AUTHORITY_SYNC_RUN_ONCE === 'true') {
    await runAuthoritySyncCycle();
    return;
  }

  void runAuthoritySyncCycle().catch((error) => {
    console.error('[Authority Worker] startup sync failed:', error);
  });

  setInterval(() => {
    void runAuthoritySyncCycle().catch((error) => {
      console.error('[Authority Worker] periodic sync failed:', error);
    });
  }, intervalMinutes * 60 * 1000);

  setInterval(() => {
    void runTranslationWarmup('interval').catch((error) => {
      console.error('[Authority Worker] interval translation warmup failed:', error);
    });
  }, translationWarmupIntervalMinutes * 60 * 1000);
}

main().catch((error) => {
  console.error('[Authority Worker] failed:', error);
  process.exit(1);
});

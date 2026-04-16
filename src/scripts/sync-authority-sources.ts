import '../config/env';
import { syncAllAuthoritySources, syncAuthoritySource } from '../services/authority-sync.service';

async function main() {
  const mode = (process.env.AUTHORITY_SYNC_MODE || 'incremental') as 'full' | 'incremental';
  const sourceId = process.env.AUTHORITY_SOURCE_ID;

  const startedAt = new Date().toISOString();
  console.log(`[Authority Sync] started at ${startedAt}, mode=${mode}, source=${sourceId || 'ALL'}`);

  const summaries = sourceId
    ? [await syncAuthoritySource(sourceId, mode)]
    : await syncAllAuthoritySources(mode);

  console.log(JSON.stringify({
    startedAt,
    finishedAt: new Date().toISOString(),
    mode,
    summaries,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Authority Sync] failed:', error);
    process.exit(1);
  });

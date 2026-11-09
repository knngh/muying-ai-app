import '../config/env';
import { warmKnowledgeLayoutBatch } from '../services/knowledge-layout-warmup.service';

async function main() {
  const once = process.env.KNOWLEDGE_LAYOUT_RUN_ONCE === 'true';
  do {
    let intervalMs = 15 * 60_000;
    try {
      const result = await warmKnowledgeLayoutBatch(Number(process.env.KNOWLEDGE_LAYOUT_BATCH_LIMIT || 30));
      console.log('[Knowledge layout] batch', JSON.stringify(result));
      if (result.formatted + result.failed > 0) intervalMs = 60_000;
    } catch {
      console.error('[Knowledge layout] batch unavailable; will retry next interval');
      if (once) process.exitCode = 1;
    }
    if (once) break;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  } while (!once);
}

void main();

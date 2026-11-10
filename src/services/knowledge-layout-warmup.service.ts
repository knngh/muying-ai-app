import {
  buildKnowledgeLayoutSourceFingerprint,
  formatKnowledgeLayoutWithAI,
  loadKnowledgeLayoutCache,
  saveKnowledgeLayoutCache,
  KNOWLEDGE_LAYOUT_VERSION,
} from './knowledge-layout.service';
import { getKnowledgeLayoutSourceLines, getKnowledgeLayoutSourceText } from '../utils/knowledge-layout';

interface LayoutArticle { slug: string; content?: string; displayContent?: string; sourceUpdatedAt?: string; updatedAt?: string; publishedAt?: string }

async function readApi<T>(path: string): Promise<T> {
  const base = process.env.KNOWLEDGE_LAYOUT_API_ORIGIN || 'http://127.0.0.1:3000';
  const response = await fetch(`${base}/api/v1${path}`, {
    signal: AbortSignal.timeout(20000), headers: { 'X-Knowledge-Layout': 'warmup' },
  });
  if (!response.ok) throw new Error(`Knowledge layout input HTTP ${response.status}`);
  const body = await response.json() as { code: number; data: T };
  if (body.code !== 0) throw new Error('Knowledge layout input unavailable');
  return body.data;
}

/** One writer processes a bounded batch. Failed inputs wait six hours before retry. */
export async function warmKnowledgeLayoutBatch(limit = 30) {
  const cache = loadKnowledgeLayoutCache();
  const report = { scanned: 0, formatted: 0, failed: 0, skipped: 0 };
  const maximum = Number.isFinite(limit) ? Math.max(1, Math.min(30, Math.floor(limit))) : 30;
  let detailRequests = 0;
  let attempted = 0;
  const pending: Promise<void>[] = [];
  for (let page = 1; page <= 30 && attempted < maximum && detailRequests < 100; page += 1) {
    const list = await readApi<{ list: LayoutArticle[]; pagination: { totalPages: number } }>(
      `/articles?contentType=authority&sort=recommended&pageSize=100&page=${page}`,
    );
    for (const item of list.list) {
      if (attempted >= maximum || detailRequests >= 100) break;
      report.scanned += 1;
      const inputRevision = item.sourceUpdatedAt || item.updatedAt || item.publishedAt || '';
      const previous = cache[item.slug];
      const retryAfter = previous?.failedAt ? 6 * 3600_000 : 24 * 3600_000;
      if (previous?.layoutVersion === KNOWLEDGE_LAYOUT_VERSION && previous.inputRevision === inputRevision && Date.now() - Date.parse(previous.updatedAt) < retryAfter) {
        report.skipped += 1;
        continue;
      }
      detailRequests += 1;
      let article: LayoutArticle;
      try {
        article = await readApi<LayoutArticle>(`/articles/${encodeURIComponent(item.slug)}`);
      } catch {
        const now = new Date().toISOString();
        cache[item.slug] = { slug: item.slug, sourceFingerprint: '', inputRevision, updatedAt: now,
          failedAt: now, blocks: [], layoutVersion: KNOWLEDGE_LAYOUT_VERSION };
        saveKnowledgeLayoutCache(cache);
        report.failed += 1;
        attempted += 1;
        continue;
      }
      const source = getKnowledgeLayoutSourceText(article.displayContent || article.content || '');
      if (!source || source.length > 200000 || getKnowledgeLayoutSourceLines(source).length > 2000) {
        cache[item.slug] = { slug: item.slug, sourceFingerprint: '', inputRevision,
          updatedAt: new Date().toISOString(), blocks: [], layoutVersion: KNOWLEDGE_LAYOUT_VERSION };
        saveKnowledgeLayoutCache(cache);
        report.skipped += 1;
        continue;
      }
      const fingerprint = buildKnowledgeLayoutSourceFingerprint(source);
      if (previous?.layoutVersion === KNOWLEDGE_LAYOUT_VERSION && previous.sourceFingerprint === fingerprint
        && (Array.isArray(previous.blocks) && previous.blocks.length > 0
          || (previous.failedAt && Date.now() - Date.parse(previous.failedAt) < 6 * 3600_000))) {
        previous.updatedAt = new Date().toISOString();
        previous.inputRevision = inputRevision;
        saveKnowledgeLayoutCache(cache);
        report.skipped += 1;
        continue;
      }
      attempted += 1;
      pending.push((async () => {
        const result = await formatKnowledgeLayoutWithAI(source);
        cache[item.slug] = {
          slug: item.slug, sourceFingerprint: fingerprint, inputRevision, updatedAt: new Date().toISOString(),
          blocks: result.blocks,
          layoutVersion: KNOWLEDGE_LAYOUT_VERSION,
          ...(result.verified
            ? { model: result.route.model, provider: result.route.provider }
            : { failedAt: new Date().toISOString(), failureReason: result.reason }),
        };
        saveKnowledgeLayoutCache(cache);
        if (result.verified) report.formatted += 1;
        else report.failed += 1;
        console.log('[Knowledge layout] article', JSON.stringify({ slug: item.slug, verified: result.verified }));
      })());
      if (pending.length >= 3) {
        await Promise.all(pending);
        pending.length = 0;
      }
    }
    await Promise.all(pending);
    pending.length = 0;
    if (page >= list.pagination.totalPages) break;
  }
  return report;
}

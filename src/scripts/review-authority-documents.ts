import '../config/env';
import fs from 'fs';
import path from 'path';
import {
  exportPublishedAuthoritySnapshot,
  listAuthorityDocuments,
  summarizeAuthorityDocumentReviewQueue,
  updateAuthorityDocumentPublishStatus,
} from '../services/authority-sync.service';

type ReviewAction = 'list' | 'publish' | 'reject' | 'export' | 'summary';

interface ReviewSummaryRow {
  publishStatus: string;
  riskLevelDefault: string;
  sourceId: string;
  topic: string;
  count: number;
}

function parseIds(rawIds: string[]): number[] {
  return rawIds
    .flatMap((value) => value.split(','))
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function resolveAction(): ReviewAction {
  const action = (process.argv[2] || process.env.AUTHORITY_REVIEW_ACTION || 'list').toLowerCase();
  if (action === 'list' || action === 'publish' || action === 'reject' || action === 'export' || action === 'summary') {
    return action;
  }

  throw new Error(`Unsupported review action: ${action}`);
}

function addCount(target: Record<string, number>, key: string, count: number): void {
  target[key] = (target[key] || 0) + count;
}

function topEntries(counts: Record<string, number>, limit = 12): Array<{ key: string; count: number }> {
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function buildReviewSummaryPayload(action: ReviewAction, publishStatus: string, sourceId: string | undefined, rows: ReviewSummaryRow[]) {
  const byRisk: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byTopic: Record<string, number> = {};

  for (const row of rows) {
    addCount(byRisk, row.riskLevelDefault || 'unknown', row.count);
    addCount(byStatus, row.publishStatus || 'unknown', row.count);
    addCount(bySource, row.sourceId || 'unknown', row.count);
    addCount(byTopic, row.topic || 'unknown', row.count);
  }

  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return {
    action,
    publishStatus,
    sourceId: sourceId || null,
    generatedAt: new Date().toISOString(),
    totals: {
      documents: total,
      byRisk,
      byStatus,
    },
    riskLayers: [
      {
        riskLevel: 'red',
        action: 'manual_review',
        count: byRisk.red || 0,
      },
      {
        riskLevel: 'yellow',
        action: 'sample_review',
        count: byRisk.yellow || 0,
      },
      {
        riskLevel: 'green',
        action: 'default_publish',
        count: byRisk.green || 0,
      },
    ],
    topSources: topEntries(bySource),
    topTopics: topEntries(byTopic),
    rows,
  };
}

function maybeWriteSummaryOutput(payload: unknown): void {
  const outputFile = process.env.AUTHORITY_REVIEW_SUMMARY_OUTPUT_FILE;
  if (!outputFile) {
    return;
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2), 'utf-8');
}

async function main() {
  const action = resolveAction();

  if (action === 'export') {
    await exportPublishedAuthoritySnapshot();
    console.log(JSON.stringify({
      action,
      exportedAt: new Date().toISOString(),
    }, null, 2));
    return;
  }

  if (action === 'summary') {
    const publishStatus = (process.env.AUTHORITY_PUBLISH_STATUS || 'review') as 'draft' | 'review' | 'published' | 'rejected' | 'all';
    const sourceId = process.env.AUTHORITY_SOURCE_ID;
    const rows = await summarizeAuthorityDocumentReviewQueue({
      publishStatus,
      sourceId,
    });
    const payload = buildReviewSummaryPayload(action, publishStatus, sourceId, rows);

    maybeWriteSummaryOutput(payload);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (action === 'list') {
    const publishStatus = (process.env.AUTHORITY_PUBLISH_STATUS || 'review') as 'draft' | 'review' | 'published' | 'rejected' | 'all';
    const sourceId = process.env.AUTHORITY_SOURCE_ID;
    const limit = Number(process.env.AUTHORITY_REVIEW_LIMIT || 20);
    const documents = await listAuthorityDocuments({
      publishStatus,
      sourceId,
      limit,
    });

    console.log(JSON.stringify({
      action,
      publishStatus,
      sourceId: sourceId || null,
      count: documents.length,
      documents: documents.map((document) => ({
        ...document,
        id: Number(document.id),
      })),
    }, null, 2));
    return;
  }

  const cliIds = process.argv.slice(3);
  const envIds = process.env.AUTHORITY_DOCUMENT_IDS ? [process.env.AUTHORITY_DOCUMENT_IDS] : [];
  const ids = parseIds(cliIds.length > 0 ? cliIds : envIds);
  if (ids.length === 0) {
    throw new Error('Missing authority document ids. Example: npm run review:authority -- publish 12 18');
  }

  const publishStatus = action === 'publish' ? 'published' : 'rejected';
  const updated = await updateAuthorityDocumentPublishStatus(ids, publishStatus);

  console.log(JSON.stringify({
    action,
    publishStatus,
    ids,
    updated,
    finishedAt: new Date().toISOString(),
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Authority Review] failed:', error);
    process.exit(1);
  });

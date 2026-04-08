import {
  exportPublishedAuthoritySnapshot,
  listAuthorityDocuments,
  updateAuthorityDocumentPublishStatus,
} from '../services/authority-sync.service';

type ReviewAction = 'list' | 'publish' | 'reject' | 'export';

function parseIds(rawIds: string[]): number[] {
  return rawIds
    .flatMap((value) => value.split(','))
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function resolveAction(): ReviewAction {
  const action = (process.argv[2] || process.env.AUTHORITY_REVIEW_ACTION || 'list').toLowerCase();
  if (action === 'list' || action === 'publish' || action === 'reject' || action === 'export') {
    return action;
  }

  throw new Error(`Unsupported review action: ${action}`);
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

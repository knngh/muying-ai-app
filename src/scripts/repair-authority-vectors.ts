import '../config/env';
import fs from 'fs';
import path from 'path';
import {
  buildAuthorityVectorId,
  getEmbedding,
  getMilvusClient,
  publishAuthorityDocumentsToVectorStore,
  searchKnowledge,
} from '../services/vector.service';

type AuthorityVectorCacheRecord = {
  source_url?: string;
  url?: string;
  original_id?: string;
  question?: string;
  title?: string;
  answer?: string;
  summary?: string;
  topic?: string;
  category?: string;
  source_org?: string;
  source?: string;
  source_class?: 'official' | 'medical_platform' | 'dataset' | 'unknown';
  is_verified?: boolean;
}

type AuthorityVectorDocument = {
  sourceUrl: string;
  title: string;
  contentText: string;
  topic: string;
  category?: string;
  sourceOrg: string;
  sourceClass?: 'official' | 'medical_platform' | 'dataset' | 'unknown';
  authoritative?: boolean;
}

type MilvusScriptClient = {
  delete: (params: { collection_name: string; filter: string }) => Promise<unknown>;
  flushSync: (params: { collection_names: string[] }) => Promise<unknown>;
  query: (params: {
    collection_name: string;
    filter: string;
    output_fields: string[];
    limit: number;
  }) => Promise<unknown>;
  loadCollectionSync?: (params: { collection_name: string }) => Promise<unknown>;
  getCollectionStatistics?: (params: { collection_name: string }) => Promise<unknown>;
}

const INPUT_FILE = process.env.INPUT_FILE || path.join(process.cwd(), 'data', 'authority-knowledge-cache.json');
const REPORT_FILE = process.env.REPORT_FILE || path.join(process.cwd(), 'tmp', 'authority-vector-repair-report.json');
const DRY_RUN = process.env.DRY_RUN !== 'false';
const OFFSET = Math.max(0, Number(process.env.OFFSET || process.env.AUTHORITY_VECTOR_REPAIR_OFFSET || 0));
const LIMIT = Number(process.env.LIMIT || process.env.AUTHORITY_VECTOR_REPAIR_LIMIT || 12);
const VERIFY_LIMIT = Math.max(1, Number(process.env.VERIFY_LIMIT || process.env.AUTHORITY_VECTOR_REPAIR_VERIFY_LIMIT || 12));
const WAIT_MS = Math.max(0, Number(process.env.WAIT_MS || process.env.AUTHORITY_VECTOR_REPAIR_WAIT_MS || 5000));
const SEARCH_QUERY = process.env.SEARCH_QUERY || process.env.AUTHORITY_VECTOR_REPAIR_SEARCH_QUERY || '宝宝发热怎么办';
const CLEAN_DEBUG_IDS = process.env.CLEAN_DEBUG_IDS !== 'false';
const DEBUG_VECTOR_IDS = parseList(process.env.DEBUG_VECTOR_IDS || process.env.AUTHORITY_VECTOR_DEBUG_IDS || 'debug-vector-1779688457892');

function parseList(input: string): string[] {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function writeJson(filePath: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

function readJsonArray<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array: ${filePath}`);
  }

  return parsed as T[];
}

function resolveCollectionName(): string {
  if (process.env.MILVUS_COLLECTION_NAME) {
    return process.env.MILVUS_COLLECTION_NAME;
  }

  const embeddingModel = process.env.EMBEDDING_MODEL || process.env.OPENAI_EMBEDDING_MODEL || process.env.AI_EMBEDDING_MODEL || 'BAAI/bge-m3';
  return /BAAI\/bge-m3/i.test(embeddingModel)
    ? 'muying_knowledge_bge_m3_filtered'
    : 'muying_knowledge';
}

function quoteMilvusString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function getRows(result: unknown): Record<string, unknown>[] {
  const payload = result as {
    data?: unknown;
    results?: unknown;
  };

  if (Array.isArray(payload.data)) {
    return payload.data as Record<string, unknown>[];
  }

  if (Array.isArray(payload.results)) {
    return payload.results as Record<string, unknown>[];
  }

  return [];
}

function toVectorDocument(record: AuthorityVectorCacheRecord): AuthorityVectorDocument | null {
  const sourceUrl = record.source_url || record.url || record.original_id || '';
  const title = record.question || record.title || '';
  const contentText = record.answer || record.summary || '';
  const topic = record.topic || record.category || 'authority';
  const sourceOrg = record.source_org || record.source || 'Authority';

  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl) || !title || !contentText) {
    return null;
  }

  return {
    sourceUrl,
    title,
    contentText,
    topic,
    category: record.category,
    sourceOrg,
    sourceClass: record.source_class,
    authoritative: record.is_verified,
  };
}

function selectDocuments(documents: AuthorityVectorDocument[]): AuthorityVectorDocument[] {
  const start = Math.min(OFFSET, documents.length);
  const remaining = documents.slice(start);

  if (!Number.isFinite(LIMIT) || LIMIT < 0) {
    throw new Error(`Invalid LIMIT: ${LIMIT}`);
  }

  if (LIMIT === 0) {
    return remaining;
  }

  return remaining.slice(0, LIMIT);
}

async function safeLoadCollection(client: MilvusScriptClient, collectionName: string): Promise<unknown | null> {
  if (typeof client.loadCollectionSync !== 'function') {
    return null;
  }

  try {
    return await client.loadCollectionSync({ collection_name: collectionName });
  } catch {
    return null;
  }
}

async function getCollectionStatistics(client: MilvusScriptClient, collectionName: string): Promise<unknown | null> {
  if (typeof client.getCollectionStatistics !== 'function') {
    return null;
  }

  try {
    return await client.getCollectionStatistics({ collection_name: collectionName });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function queryVisibleDocuments(
  client: MilvusScriptClient,
  collectionName: string,
  ids: string[],
): Promise<{ count: number; sample: Array<{ id: string; source: string; question: string }> }> {
  if (ids.length === 0) {
    return { count: 0, sample: [] };
  }

  const verifyIds = ids.slice(0, VERIFY_LIMIT);
  const result = await client.query({
    collection_name: collectionName,
    filter: `id in [${verifyIds.map(quoteMilvusString).join(', ')}]`,
    output_fields: ['id', 'question', 'source'],
    limit: verifyIds.length,
  });
  const rows = getRows(result);

  return {
    count: rows.length,
    sample: rows.slice(0, 5).map((row) => ({
      id: String(row.id || ''),
      source: String(row.source || ''),
      question: String(row.question || '').slice(0, 80),
    })),
  };
}

async function deleteDebugVectors(client: MilvusScriptClient, collectionName: string): Promise<unknown | null> {
  if (!CLEAN_DEBUG_IDS || DEBUG_VECTOR_IDS.length === 0 || DRY_RUN) {
    return null;
  }

  const result = await client.delete({
    collection_name: collectionName,
    filter: `id in [${DEBUG_VECTOR_IDS.map(quoteMilvusString).join(', ')}]`,
  });
  await client.flushSync({ collection_names: [collectionName] });
  return result;
}

async function main(): Promise<void> {
  const records = readJsonArray<AuthorityVectorCacheRecord>(INPUT_FILE);
  const documents = records
    .map(toVectorDocument)
    .filter((item): item is AuthorityVectorDocument => Boolean(item));
  const selectedDocuments = selectDocuments(documents);
  const selectedIds = selectedDocuments.map((document) => buildAuthorityVectorId(document.sourceUrl));
  const collectionName = resolveCollectionName();

  if (selectedDocuments.length === 0) {
    throw new Error('No authority vector documents selected for repair');
  }

  const client = await getMilvusClient() as unknown as MilvusScriptClient;
  await safeLoadCollection(client, collectionName);

  const debugCleanup = await deleteDebugVectors(client, collectionName);
  const before = await queryVisibleDocuments(client, collectionName, selectedIds);

  const publish = DRY_RUN
    ? { published: 0, skipped: selectedDocuments.length }
    : await publishAuthorityDocumentsToVectorStore(selectedDocuments);

  if (!DRY_RUN) {
    await sleep(WAIT_MS);
  }

  const after = await queryVisibleDocuments(client, collectionName, selectedIds);
  const search = DRY_RUN
    ? null
    : await searchKnowledge(await getEmbedding(SEARCH_QUERY), 5);

  const report = {
    generatedAt: new Date().toISOString(),
    inputFile: INPUT_FILE,
    reportFile: REPORT_FILE,
    dryRun: DRY_RUN,
    collectionName,
    offset: OFFSET,
    limit: LIMIT,
    scanned: records.length,
    eligible: documents.length,
    selected: selectedDocuments.length,
    debugCleanup: debugCleanup
      ? { ids: DEBUG_VECTOR_IDS, result: debugCleanup }
      : { ids: DEBUG_VECTOR_IDS, skipped: true },
    before,
    publish,
    after,
    collectionStatistics: await getCollectionStatistics(client, collectionName),
    search: search
      ? {
        query: SEARCH_QUERY,
        resultCount: search.length,
        sample: search.slice(0, 5).map((item) => ({
          id: item.id,
          source: item.source,
          category: item.category,
          score: item.score,
          question: item.question.slice(0, 80),
        })),
      }
      : null,
  };

  writeJson(REPORT_FILE, report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('[Authority Vector Repair] failed:', error);
  process.exit(1);
});

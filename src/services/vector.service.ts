// 向量数据库服务 - Milvus 集成

import '../config/env';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import { shouldPublishAuthorityVectorDocument } from '../utils/authority-vector-filter';

type MilvusFieldParamEntry = {
  key?: unknown
  value?: unknown
  dim?: unknown
}

type MilvusCollectionField = {
  name?: unknown
  dim?: unknown
  dimension?: unknown
  type_params?: unknown
  params?: unknown
  index_params?: unknown
  element_type_params?: unknown
}

type MilvusCollectionSchema = {
  schema?: {
    fields?: unknown
  }
  fields?: unknown
}

type MilvusSearchResultRow = {
  id?: unknown
  question?: unknown
  answer?: unknown
  category?: unknown
  source?: unknown
  score?: unknown
}

type MilvusSearchResponse = {
  results?: MilvusSearchResultRow[]
}

// Milvus 配置
const RAW_MILVUS_ADDRESS = process.env.MILVUS_ADDRESS
  || process.env.ZILLIZ_PUBLIC_ENDPOINT
  || process.env.ZILLIZ_ENDPOINT
  || 'localhost:19530';
const { address: MILVUS_ADDRESS, ssl: MILVUS_SSL } = normalizeMilvusConnection(RAW_MILVUS_ADDRESS);
const MILVUS_TOKEN = process.env.MILVUS_TOKEN
  || process.env.ZILLIZ_TOKEN
  || process.env.ZILLIZ_API_KEY
  || '';
const EMBEDDING_API_BASE_URL = process.env.EMBEDDING_API_URL
  || process.env.OPENAI_API_BASE_URL
  || process.env.AI_EMBEDDING_URL
  || process.env.AI_GATEWAY_URL
  || process.env.AI_GENERAL_URL
  || 'https://api.openai.com/v1';
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY
  || process.env.OPENAI_API_KEY
  || process.env.AI_GATEWAY_KEY
  || process.env.AI_GENERAL_KEY
  || process.env.AI_MEDICAL_PRIMARY_KEY
  || '';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL
  || process.env.OPENAI_EMBEDDING_MODEL
  || process.env.AI_EMBEDDING_MODEL
  || resolveDefaultEmbeddingModel(EMBEDDING_API_BASE_URL);
const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM || resolveEmbeddingDim(EMBEDDING_MODEL));
const COLLECTION_NAME = process.env.MILVUS_COLLECTION_NAME || resolveDefaultCollectionName(EMBEDDING_MODEL);
const MILVUS_TIMEOUT_MS = Math.max(5000, Number(process.env.MILVUS_TIMEOUT_MS || 30000));
const EMBEDDING_CONCURRENCY = Math.max(1, Number(process.env.EMBEDDING_CONCURRENCY || 1));
const EMBEDDING_RETRY_429_LIMIT = Math.max(0, Number(process.env.EMBEDDING_RETRY_429_LIMIT || 3));
const EMBEDDING_RETRY_429_DELAY_MS = Math.max(0, Number(process.env.EMBEDDING_RETRY_429_DELAY_MS || 3000));
const EMBEDDING_REQUEST_DELAY_MS = Math.max(0, Number(process.env.EMBEDDING_REQUEST_DELAY_MS || 800));
const VECTOR_INSERT_BATCH_SIZE = Math.max(1, Number(process.env.VECTOR_INSERT_BATCH_SIZE || 50));

function resolveDefaultEmbeddingModel(baseUrl: string): string {
  if (baseUrl.includes('dashscope.aliyuncs.com')) {
    return 'text-embedding-v4';
  }

  return 'BAAI/bge-m3';
}

function resolveEmbeddingDim(model: string): number {
  if (/BAAI\/bge-m3/i.test(model)) {
    return 1024;
  }

  if (/Qwen\/Qwen3-Embedding-8B/i.test(model)) {
    return 4096;
  }

  return 1536;
}

function resolveDefaultCollectionName(model: string): string {
  if (/BAAI\/bge-m3/i.test(model)) {
    return 'muying_knowledge_bge_m3_filtered';
  }

  return 'muying_knowledge';
}

function normalizeMilvusConnection(rawAddress: string): { address: string; ssl: boolean } {
  const trimmed = rawAddress.trim();
  if (!trimmed) {
    return { address: 'localhost:19530', ssl: false };
  }

  if (!/^[a-z]+:\/\//i.test(trimmed)) {
    return { address: trimmed, ssl: false };
  }

  try {
    const parsed = new URL(trimmed);
    const ssl = parsed.protocol === 'https:';
    const host = parsed.hostname;
    const port = parsed.port || (ssl ? '443' : '80');

    if (!host) {
      return { address: trimmed, ssl };
    }

    return {
      address: `${host}:${port}`,
      ssl,
    };
  } catch {
    return {
      address: trimmed,
      ssl: /^https:\/\//i.test(trimmed),
    };
  }
}

function truncateUtf8(input: string, maxBytes: number): string {
  if (Buffer.byteLength(input, 'utf8') <= maxBytes) {
    return input;
  }

  let low = 0;
  let high = input.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = input.slice(0, mid);
    if (Buffer.byteLength(candidate, 'utf8') <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return input.slice(0, low);
}

function toVectorSafeText(input: string, maxBytes = 3500): string {
  return truncateUtf8(input.replace(/\s+/g, ' ').trim(), maxBytes);
}

function buildAuthorityVectorId(sourceUrl: string): string {
  let hash = 0;
  for (let index = 0; index < sourceUrl.length; index += 1) {
    hash = ((hash << 5) - hash) + sourceUrl.charCodeAt(index);
    hash |= 0;
  }
  return `authority-${Math.abs(hash)}`;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(0, retryAt - Date.now());
}

function extractCollectionEmbeddingDim(collectionInfo: MilvusCollectionSchema): number | null {
  const fields = Array.isArray(collectionInfo?.schema?.fields)
    ? collectionInfo.schema.fields as MilvusCollectionField[]
    : (Array.isArray(collectionInfo?.fields) ? collectionInfo.fields as MilvusCollectionField[] : []);
  const embeddingField = fields.find((field) => field?.name === 'embedding');

  if (!embeddingField) {
    return null;
  }

  const directCandidates = [embeddingField.dim, embeddingField.dimension];
  for (const candidate of directCandidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const paramGroups = [
    embeddingField.type_params,
    embeddingField.params,
    embeddingField.index_params,
    embeddingField.element_type_params,
  ];

  for (const group of paramGroups) {
    if (!Array.isArray(group)) {
      continue;
    }

    for (const entry of group as MilvusFieldParamEntry[]) {
      const directDim = Number(entry?.dim);
      if (Number.isFinite(directDim) && directDim > 0) {
        return directDim;
      }

      const key = typeof entry?.key === 'string' ? entry.key : '';
      const value = Number(entry?.value);
      if (/^dim$/i.test(key) && Number.isFinite(value) && value > 0) {
        return value;
      }
    }
  }

  return null;
}

async function ensureCollectionEmbeddingDim(client: MilvusClient): Promise<void> {
  const describeCollection = (client as MilvusClient & {
    describeCollection?: (params: { collection_name: string }) => Promise<unknown>;
  }).describeCollection;

  if (typeof describeCollection !== 'function') {
    return;
  }

  const collectionInfo = await describeCollection.call(client, { collection_name: COLLECTION_NAME });
  const collectionDim = extractCollectionEmbeddingDim(collectionInfo as MilvusCollectionSchema);

  if (collectionDim && collectionDim !== EMBEDDING_DIM) {
    throw new Error(
      `Milvus collection "${COLLECTION_NAME}" dim=${collectionDim}, but embedding model "${EMBEDDING_MODEL}" expects dim=${EMBEDDING_DIM}. `
      + '请改用新的 MILVUS_COLLECTION_NAME，或删除旧集合后重新导入向量。',
    );
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await mapper(items[index]!, index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// 初始化 Milvus 客户端
let milvusClient: MilvusClient | null = null;
let lastEmbeddingRequestAt = 0;

export async function getMilvusClient(): Promise<MilvusClient> {
  if (!milvusClient) {
    milvusClient = new MilvusClient({
      address: MILVUS_ADDRESS,
      token: MILVUS_TOKEN || undefined,
      ssl: MILVUS_SSL,
      timeout: MILVUS_TIMEOUT_MS,
    });
    await milvusClient.connectPromise;
  }
  return milvusClient;
}

// 创建知识库集合
export async function createKnowledgeCollection(): Promise<void> {
  const client = await getMilvusClient();
  
  // 检查集合是否存在
  const hasCollection = await client.hasCollection({ collection_name: COLLECTION_NAME });
  
  if (!hasCollection.value) {
    // 创建集合
    await client.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        {
          name: 'id',
          description: '文档ID',
          data_type: 'VarChar',
          max_length: 64,
          is_primary_key: true,
        },
        {
          name: 'embedding',
          description: '向量嵌入',
          data_type: 'FloatVector',
          dim: EMBEDDING_DIM,
        },
        {
          name: 'question',
          description: '问题',
          data_type: 'VarChar',
          max_length: 1000,
        },
        {
          name: 'answer',
          description: '答案',
          data_type: 'VarChar',
          max_length: 4000,
        },
        {
          name: 'category',
          description: '分类',
          data_type: 'VarChar',
          max_length: 50,
        },
        {
          name: 'source',
          description: '来源',
          data_type: 'VarChar',
          max_length: 100,
        },
      ],
    });
    
    // 创建索引
    await client.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'embedding',
      index_type: 'IVF_FLAT',
      metric_type: 'L2',
      params: { nlist: 1024 },
    });
    
    // 加载集合
    await client.loadCollectionSync({ collection_name: COLLECTION_NAME });
    
    console.log('✅ 知识库集合创建成功');
    return;
  }

  await ensureCollectionEmbeddingDim(client);
}

// 插入文档
export async function insertDocuments(documents: Array<{
  id: string;
  embedding: number[];
  question: string;
  answer: string;
  category: string;
  source: string;
}>): Promise<void> {
  const client = await getMilvusClient();
  let totalInserted = 0;

  for (let start = 0; start < documents.length; start += VECTOR_INSERT_BATCH_SIZE) {
    const batch = documents.slice(start, start + VECTOR_INSERT_BATCH_SIZE);
    const result = await client.insert({
      collection_name: COLLECTION_NAME,
      data: batch,
    });

    const insertedCount = typeof (result as { insert_cnt?: unknown }).insert_cnt === 'number'
      ? (result as { insert_cnt: number }).insert_cnt
      : (typeof (result as { insert_cnt?: unknown }).insert_cnt === 'string'
        ? Number((result as { insert_cnt: string }).insert_cnt)
        : (Array.isArray((result as { succ_index?: unknown }).succ_index)
          ? (result as { succ_index: unknown[] }).succ_index.length
          : batch.length));
    const failedCount = Array.isArray((result as { err_index?: unknown }).err_index)
      ? (result as { err_index: unknown[] }).err_index.length
      : 0;

    if (failedCount > 0) {
      throw new Error(`Vector insert batch failed: inserted=${insertedCount}, failed=${failedCount}, batchSize=${batch.length}`);
    }

    totalInserted += insertedCount;
  }

  await client.flushSync({
    collection_names: [COLLECTION_NAME],
  });

  console.log(`✅ 插入 ${totalInserted} 条文档`);
}

export async function deleteDocumentsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const client = await getMilvusClient();
  const quotedIds = ids.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(', ');

  await client.delete({
    collection_name: COLLECTION_NAME,
    filter: `id in [${quotedIds}]`,
  });
}

export async function publishAuthorityDocumentsToVectorStore(documents: Array<{
  sourceUrl: string;
  title: string;
  contentText: string;
  topic: string;
  sourceOrg: string;
  category?: string;
  sourceClass?: 'official' | 'medical_platform' | 'dataset' | 'unknown';
  authoritative?: boolean;
}>): Promise<{ published: number; skipped: number }> {
  if (documents.length === 0) {
    return { published: 0, skipped: 0 };
  }

  await createKnowledgeCollection();

  const prepared = documents
    .map((document) => {
      if (!shouldPublishAuthorityVectorDocument({
        title: document.title,
        answer: document.contentText,
        topic: document.topic,
        category: document.category,
        sourceOrg: document.sourceOrg,
        sourceClass: document.sourceClass,
        authoritative: document.authoritative,
      })) {
        return null;
      }

      const question = toVectorSafeText(document.title, 900);
      const answer = toVectorSafeText(document.contentText, 3800);
      if (!question || !answer) {
        return null;
      }

      return {
        id: buildAuthorityVectorId(document.sourceUrl),
        sourceUrl: document.sourceUrl,
        question,
        answer,
        category: toVectorSafeText(document.topic, 48) || 'authority',
        source: toVectorSafeText(document.sourceOrg, 96) || 'Authority',
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (prepared.length === 0) {
    return { published: 0, skipped: documents.length };
  }

  const ids = prepared.map((item) => item.id);
  try {
    await deleteDocumentsByIds(ids);
  } catch (error) {
    console.warn('[Vector] 删除旧权威向量失败，将尝试继续插入:', error);
  }

  const data = await mapWithConcurrency(prepared, EMBEDDING_CONCURRENCY, async (item) => ({
    id: item.id,
    embedding: await getEmbedding(`${item.question} ${item.answer}`),
    question: item.question,
    answer: item.answer,
    category: item.category,
    source: item.source,
  }));

  await insertDocuments(data);
  return {
    published: data.length,
    skipped: documents.length - data.length,
  };
}

// 向量检索
export async function searchKnowledge(
  queryEmbedding: number[],
  topK: number = 5
): Promise<Array<{
  id: string;
  question: string;
  answer: string;
  category: string;
  source: string;
  score: number;
}>> {
  const client = await getMilvusClient();
  
  const results = await client.search({
    collection_name: COLLECTION_NAME,
    vector: queryEmbedding,
    top_k: topK,
    params: { nprobe: 10 },
    output_fields: ['id', 'question', 'answer', 'category', 'source'],
  }) as MilvusSearchResponse;
  
  return (results.results || []).map((result) => ({
    id: String(result.id ?? ''),
    question: String(result.question ?? ''),
    answer: String(result.answer ?? ''),
    category: String(result.category ?? ''),
    source: String(result.source ?? ''),
    score: Number(result.score ?? 0),
  }));
}

function resolveEmbeddingEndpoint(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/g, '');
  if (!normalized) {
    throw new Error('Embedding API URL is not configured');
  }

  return /\/embeddings$/i.test(normalized) ? normalized : `${normalized}/embeddings`;
}

// 获取嵌入向量（调用 OpenAI API）
export async function getEmbedding(text: string): Promise<number[]> {
  if (!EMBEDDING_API_KEY) {
    throw new Error('Embedding API key is not configured');
  }

  for (let attempt = 0; ; attempt += 1) {
    const elapsed = Date.now() - lastEmbeddingRequestAt;
    if (elapsed < EMBEDDING_REQUEST_DELAY_MS) {
      await sleep(EMBEDDING_REQUEST_DELAY_MS - elapsed);
    }

    const response = await fetch(resolveEmbeddingEndpoint(EMBEDDING_API_BASE_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMBEDDING_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });
    lastEmbeddingRequestAt = Date.now();

    const bodyText = await response.text();
    let data: {
      data?: Array<{ embedding?: number[] }>;
      error?: { message?: string };
    } | null = null;
    try {
      data = JSON.parse(bodyText) as {
        data?: Array<{ embedding?: number[] }>;
        error?: { message?: string };
      };
    } catch {
      data = null;
    }

    const embedding = data?.data?.[0]?.embedding;
    if (response.ok && Array.isArray(embedding)) {
      if (embedding.length !== EMBEDDING_DIM) {
        throw new Error(
          `Embedding dimension mismatch: expected ${EMBEDDING_DIM}, received ${embedding.length} from model "${EMBEDDING_MODEL}"`,
        );
      }
      return embedding;
    }

    const shouldRetry = response.status === 429
      || response.status >= 500
      || !data;

    if (shouldRetry && attempt < EMBEDDING_RETRY_429_LIMIT) {
      const delayMs = parseRetryAfterMs(response.headers.get('retry-after'))
        ?? (EMBEDDING_RETRY_429_DELAY_MS * (attempt + 1));
      await sleep(delayMs);
      continue;
    }

    throw new Error(data?.error?.message || bodyText.slice(0, 200) || `Embedding request failed with status ${response.status}`);
  }
}

// 向量数据库服务 - Milvus 集成

import { MilvusClient } from '@zilliz/milvus2-sdk-node';

// Milvus 配置
const MILVUS_ADDRESS = process.env.MILVUS_ADDRESS || 'localhost:19530';
const COLLECTION_NAME = 'muying_knowledge';

// 初始化 Milvus 客户端
let milvusClient: MilvusClient | null = null;

export async function getMilvusClient(): Promise<MilvusClient> {
  if (!milvusClient) {
    milvusClient = new MilvusClient({
      address: MILVUS_ADDRESS,
      timeout: 5000,
    });
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
          dim: 1536, // OpenAI embedding dimension
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
  }
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
  
  await client.insert({
    collection_name: COLLECTION_NAME,
    data: documents,
  });
  
  console.log(`✅ 插入 ${documents.length} 条文档`);
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
  });
  
  return results.results.map((result: any) => ({
    id: result.id,
    question: result.question,
    answer: result.answer,
    category: result.category,
    source: result.source,
    score: result.score,
  }));
}

// 获取嵌入向量（调用 OpenAI API）
export async function getEmbedding(text: string): Promise<number[]> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    // 返回模拟向量
    return Array(1536).fill(0).map(() => Math.random() - 0.5);
  }
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  });
  
  const data: any = await response.json();
  return data.data[0].embedding;
}
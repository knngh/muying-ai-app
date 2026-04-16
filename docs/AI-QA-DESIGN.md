# AI 问答 API 设计

## 概述

母婴网页 AI 问答模块，基于 RAG（检索增强生成）技术，为用户提供智能问答服务。

---

## 一、接口设计

### 1.1 用户提问

```http
POST /api/v1/ai/ask
Authorization: Bearer <token>
Content-Type: application/json

{
  "question": "孕早期可以吃螃蟹吗？",
  "context": {
    "stage": "pregnancy-early",
    "weeks": 8
  }
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "answer": "孕早期建议谨慎食用螃蟹...",
    "sources": [
      {
        "title": "孕早期饮食注意事项",
        "url": "/articles/yun-zao-qi-yin-shi"
      }
    ],
    "confidence": 0.85,
    "followUpQuestions": [
      "孕早期还有什么食物需要忌口？",
      "孕早期营养补充建议有哪些？"
    ]
  }
}
```

### 1.2 连续对话

```http
POST /api/v1/ai/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "我怀孕8周了，最近孕吐严重怎么办？" },
    { "role": "assistant", "content": "孕吐是孕早期常见症状..." },
    { "role": "user", "content": "有什么方法可以缓解？" }
  ],
  "context": {
    "stage": "pregnancy-early",
    "weeks": 8
  }
}
```

### 1.3 知识库检索

```http
GET /api/v1/knowledge/search?q=孕吐&category=pregnancy&limit=5
Authorization: Bearer <token>
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "results": [
      {
        "id": "qa-001",
        "question": "孕吐严重怎么办？",
        "answer": "孕吐严重时可以尝试以下方法...",
        "category": "pregnancy-early",
        "score": 0.92
      }
    ],
    "total": 15
  }
}
```

---

## 二、RAG 架构

```
用户提问
    ↓
[问题理解] → 提取关键信息、意图识别
    ↓
[向量检索] → 从向量数据库检索相关文档
    ↓
[上下文构建] → 整合检索结果 + 用户上下文
    ↓
[大模型生成] → 调用 LLM 生成回答
    ↓
[后处理] → 添加来源、相关推荐
    ↓
返回回答
```

---

## 三、数据结构

### 3.1 知识库文档

```typescript
interface KnowledgeDocument {
  id: string;
  type: 'qa' | 'article' | 'tips';
  question?: string;
  answer?: string;
  content?: string;
  category: string;
  tags: string[];
  source: string;
  sourceUrl?: string;
  verified: boolean;
  embedding?: number[];  // 向量嵌入
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.2 对话历史

```typescript
interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  context: UserContext;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}
```

---

## 四、向量数据库

### 4.1 Milvus 配置

```yaml
# docker-compose.yml
milvus:
  image: milvusdb/milvus:latest
  container_name: muying-milvus
  ports:
    - "19530:19530"
  volumes:
    - milvus_data:/var/lib/milvus
```

### 4.2 集合设计

```python
# knowledge_collection
fields = [
    FieldSchema(name="id", dtype=DataType.VARCHAR, max_length=64, is_primary=True),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1024),
    FieldSchema(name="question", dtype=DataType.VARCHAR, max_length=500),
    FieldSchema(name="answer", dtype=DataType.VARCHAR, max_length=2000),
    FieldSchema(name="category", dtype=DataType.VARCHAR, max_length=50),
    FieldSchema(name="source", dtype=DataType.VARCHAR, max_length=100),
]
```

---

## 五、大模型集成

### 5.1 OpenAI 接口

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateAnswer(
  question: string,
  context: string[]
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: `你是一位专业的母婴健康顾问。请基于以下知识回答用户问题。
        
知识库：
${context.join('\n\n')}

要求：
1. 回答专业、准确、有同理心
2. 如涉及医疗建议，提醒咨询专业医生
3. 引用知识库来源`
      },
      { role: 'user', content: question }
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });
  
  return response.choices[0].message.content;
}
```

### 5.2 本地模型（备选）

```typescript
// Ollama 本地模型
async function generateWithOllama(question: string, context: string[]): Promise<string> {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2:7b',
      prompt: `基于以下知识回答问题：\n\n${context.join('\n\n')}\n\n问题：${question}`,
      stream: false
    })
  });
  
  return (await response.json()).response;
}
```

---

## 六、安全与合规

### 6.1 免责声明

每次 AI 回答自动附加：
> ⚠️ 本回答由 AI 生成，仅供参考。如涉及健康问题，请咨询专业医生。

### 6.2 敏感词过滤

```typescript
const sensitiveTopics = [
  '药物剂量',
  '具体诊断',
  '治疗方案',
  // ...
];

function containsSensitiveContent(text: string): boolean {
  return sensitiveTopics.some(topic => text.includes(topic));
}
```

### 6.3 请求限流

```typescript
// 每个用户每天最多 50 次 AI 问答
const rateLimit = {
  windowMs: 24 * 60 * 60 * 1000,
  max: 50,
  message: '今日问答次数已用完，请明天再来'
};
```

---

## 七、监控与日志

### 7.1 问答日志

```typescript
interface QALog {
  userId: string;
  question: string;
  answer: string;
  sources: string[];
  confidence: number;
  responseTime: number;
  feedback?: 'positive' | 'negative';
  createdAt: Date;
}
```

### 7.2 质量指标

- 准确率：用户正向反馈比例
- 覆盖率：知识库检索命中比例
- 响应时间：平均响应耗时

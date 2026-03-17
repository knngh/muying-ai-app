// RAG 检索增强生成服务

import { searchKnowledge, getEmbedding } from './vector.service';
import { callKimiAPI } from '../controllers/ai.controller';

// RAG 系统提示词
const RAG_SYSTEM_PROMPT = `你是一位专业的母婴健康顾问，请基于提供的知识库内容回答用户问题。

回答要求：
1. 优先使用知识库中的信息
2. 专业、准确、有同理心
3. 使用通俗易懂的语言
4. 如涉及用药或治疗建议，必须提醒咨询医生
5. 不要给出具体药物剂量
6. 对于不确定的问题，建议咨询专业医生

知识库内容：
{CONTEXT}

请根据以上知识回答用户问题。如果知识库中没有相关信息，请诚实告知，并建议咨询专业医生。`;

// RAG 问答流程
export async function ragAnswer(question: string): Promise<{
  answer: string;
  sources: Array<{ title: string; url: string }>;
  confidence: number;
}> {
  try {
    // 1. 获取问题嵌入向量
    const queryEmbedding = await getEmbedding(question);
    
    // 2. 从向量数据库检索相关知识
    const relevantDocs = await searchKnowledge(queryEmbedding, 3);
    
    // 3. 构建上下文
    let context = '';
    const sources: Array<{ title: string; url: string }> = [];
    
    if (relevantDocs.length > 0) {
      context = relevantDocs.map((doc, index) => {
        sources.push({
          title: doc.question,
          url: `/knowledge/${doc.id}`,
        });
        return `[${index + 1}] 问题：${doc.question}\n答案：${doc.answer}\n来源：${doc.source}`;
      }).join('\n\n');
    } else {
      context = '（知识库中暂无相关内容）';
    }
    
    // 4. 构建 RAG 系统提示词
    const systemPrompt = RAG_SYSTEM_PROMPT.replace('{CONTEXT}', context);
    
    // 5. 调用大模型生成回答
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ];
    
    const answer = await callKimiAPI(messages);
    
    // 6. 计算置信度
    const confidence = relevantDocs.length > 0 
      ? Math.max(...relevantDocs.map(d => d.score)) 
      : 0.3;
    
    return {
      answer,
      sources,
      confidence: Math.min(confidence, 1.0),
    };
  } catch (error) {
    console.error('RAG Error:', error);
    return {
      answer: '抱歉，服务暂时不可用。如有健康问题，请咨询专业医生。',
      sources: [],
      confidence: 0,
    };
  }
}

// 批量导入知识库
export async function importKnowledge(documents: Array<{
  id: string;
  question: string;
  answer: string;
  category: string;
  source: string;
}>): Promise<number> {
  const { insertDocuments } = await import('./vector.service');
  
  let imported = 0;
  const batchSize = 100;
  
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    
    // 获取嵌入向量
    const docs = await Promise.all(
      batch.map(async (doc) => {
        const embedding = await getEmbedding(`${doc.question} ${doc.answer}`);
        return {
          ...doc,
          embedding,
        };
      })
    );
    
    // 插入向量数据库
    await insertDocuments(docs);
    imported += batch.length;
    
    console.log(`📥 已导入 ${imported}/${documents.length} 条知识`);
  }
  
  return imported;
}
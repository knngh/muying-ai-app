// 数据导入脚本 - 将问答数据导入向量数据库

import fs from 'fs';
import path from 'path';
import { createKnowledgeCollection, insertDocuments, getEmbedding } from '../services/vector.service';
import { callKimiAPI } from '../controllers/ai.controller';

// 配置
const CSV_FILE = process.env.CSV_FILE || path.join(__dirname, '../../../data/question.csv');
const BATCH_SIZE = 50;
const MAX_QUESTIONS = 500;

// 问题分类映射
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'pregnancy': ['怀孕', '孕期', '孕妇', '孕早期', '孕中期', '孕晚期', '产检', '胎动', '预产期', '分娩'],
  'parenting': ['宝宝', '婴儿', '新生儿', '幼儿', '育儿', '喂养', '辅食', '睡眠', '哭闹', '发育'],
  'nutrition': ['营养', '饮食', '吃什么', '补钙', '补铁', '维生素', '食谱', '奶'],
  'vaccine': ['疫苗', '接种', '免疫', '打针', '预防针'],
  'health': ['发烧', '感冒', '咳嗽', '腹泻', '湿疹', '过敏', '疾病', '医院']
};

// 判断问题分类
function categorizeQuestion(question: string): string {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => question.includes(keyword))) {
      return category;
    }
  }
  return 'general';
}

// 为问题生成答案
async function generateAnswer(question: string): Promise<string> {
  const systemPrompt = `你是一位专业的母婴健康顾问。请简要回答以下问题（100-200字）：

要求：
1. 专业、准确、有同理心
2. 语言通俗易懂
3. 如涉及用药，提醒咨询医生`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question }
  ];

  try {
    return await callKimiAPI(messages);
  } catch (error) {
    console.error('生成答案失败:', error);
    return '抱歉，暂时无法回答这个问题。请咨询专业医生。';
  }
}

// 简单 CSV 解析
function parseCSV(content: string): Array<{ id: string; content: string }> {
  const lines = content.split('\n').slice(1); // 跳过表头
  const results: Array<{ id: string; content: string }> = [];
  
  for (let i = 0; i < lines.length && results.length < MAX_QUESTIONS; i++) {
    const line = lines[i].trim();
    if (line) {
      // 简单解析：假设格式为 id,content 或只有 content
      const parts = line.split(',');
      if (parts.length >= 2) {
        results.push({
          id: `q-${i + 1}`,
          content: parts.slice(1).join(',').replace(/"/g, '').trim()
        });
      } else if (parts.length === 1 && parts[0].length > 10) {
        results.push({
          id: `q-${i + 1}`,
          content: parts[0].replace(/"/g, '').trim()
        });
      }
    }
  }
  
  return results;
}

// 主导入函数
async function importQuestions() {
  console.log('🚀 开始导入问答数据...\n');

  try {
    // 1. 创建集合
    console.log('📦 创建向量数据库集合...');
    await createKnowledgeCollection();

    // 2. 读取文件
    console.log(`📄 读取文件: ${CSV_FILE}`);
    const fileContent = fs.readFileSync(CSV_FILE, 'utf-8');
    const questions = parseCSV(fileContent);
    
    console.log(`✅ 读取 ${questions.length} 个问题\n`);

    // 3. 批量处理
    let processed = 0;
    const documents: Array<{
      id: string;
      embedding: number[];
      question: string;
      answer: string;
      category: string;
      source: string;
    }> = [];

    for (const q of questions) {
      if (!q.content || q.content.trim().length < 5) continue;

      console.log(`📝 处理问题 ${processed + 1}/${questions.length}: ${q.content.substring(0, 30)}...`);

      try {
        // 生成答案
        const answer = await generateAnswer(q.content);
        
        // 获取嵌入向量
        const embedding = await getEmbedding(`${q.content} ${answer}`);
        
        // 分类
        const category = categorizeQuestion(q.content);

        documents.push({
          id: q.id,
          embedding,
          question: q.content,
          answer,
          category,
          source: 'cMedQA2'
        });

        processed++;

        // 批量插入
        if (documents.length >= BATCH_SIZE) {
          console.log(`\n💾 插入 ${documents.length} 条数据到向量数据库...`);
          await insertDocuments(documents);
          documents.length = 0;
        }

        // 延迟，避免 API 限流
        await new Promise(r => setTimeout(r, 300));

      } catch (error) {
        console.error(`❌ 处理失败: ${q.id}`, error);
      }
    }

    // 插入剩余数据
    if (documents.length > 0) {
      console.log(`\n💾 插入最后 ${documents.length} 条数据...`);
      await insertDocuments(documents);
    }

    console.log(`\n✅ 导入完成！共处理 ${processed} 个问答对`);

  } catch (error) {
    console.error('导入失败:', error);
    throw error;
  }
}

// 执行导入
importQuestions()
  .then(() => {
    console.log('\n🎉 所有数据导入完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 导入失败:', error);
    process.exit(1);
  });
// 数据导入脚本 - 将 Content 的 500 个问题导入向量数据库

import fs from 'fs';
import path from 'path';
import { createKnowledgeCollection, insertDocuments, getEmbedding } from '../services/vector.service';
import { callAIGateway } from '../services/ai-gateway.service';

// 配置
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../../data');
const BATCH_SIZE = 20; // 每批处理数量
const MAX_QUESTIONS = 500; // 最大导入问题数

// 问题文件列表
const QUESTION_FILES = [
  'pregnancy-questions.json',
  'parenting-questions.json',
  'nutrition-questions.json',
  'vaccine-questions.json'
];

// 为问题生成答案
async function generateAnswer(question: string, category: string): Promise<string> {
  const categoryContext: Record<string, string> = {
    '孕期': '孕期相关知识，包括备孕、孕早期、孕中期、孕晚期、分娩等',
    '育儿': '育儿相关知识，包括新生儿护理、喂养、辅食、睡眠、发育等',
    '营养': '母婴营养相关知识，包括孕期营养、宝宝营养、饮食禁忌等',
    '疫苗': '疫苗接种相关知识，包括接种时间、注意事项、不良反应等'
  };

  const systemPrompt = `你是一位专业的母婴健康顾问。请简要回答以下${categoryContext[category] || ''}问题（100-200字）：

要求：
1. 专业、准确、有同理心
2. 语言通俗易懂
3. 如涉及用药，提醒咨询医生
4. 不要给出具体药物剂量

⚠️ 免责声明：本回答由 AI 生成，仅供参考，不构成医疗建议。如有健康问题，请咨询专业医生。`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question }
  ];

  try {
    return await callAIGateway(messages as any);
  } catch (error) {
    console.error('生成答案失败:', error);
    return '抱歉，暂时无法回答这个问题。请咨询专业医生。';
  }
}

// 主导入函数
async function importQuestions() {
  console.log('🚀 开始导入 Content 的 500 个问题...\n');

  try {
    // 1. 创建集合
    console.log('📦 创建向量数据库集合...');
    await createKnowledgeCollection();

    // 2. 读取所有问题文件
    let allQuestions: Array<{
      id: string;
      question: string;
      category: string;
      sub_category: string;
      priority: string;
    }> = [];

    for (const file of QUESTION_FILES) {
      const filePath = path.join(DATA_DIR, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        try {
          const data = JSON.parse(content);
          if (data.questions && Array.isArray(data.questions)) {
            allQuestions = allQuestions.concat(data.questions);
            console.log(`✅ 读取 ${file}: ${data.questions.length} 个问题`);
          }
        } catch (e) {
          console.error(`解析 ${file} 失败:`, e);
        }
      }
    }

    // 限制数量
    if (allQuestions.length > MAX_QUESTIONS) {
      allQuestions = allQuestions.slice(0, MAX_QUESTIONS);
    }

    console.log(`\n📊 总计 ${allQuestions.length} 个问题待处理\n`);

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

    for (const q of allQuestions) {
      if (!q.question || q.question.trim().length < 5) continue;

      console.log(`📝 [${processed + 1}/${allQuestions.length}] ${q.category} - ${q.question.substring(0, 30)}...`);

      try {
        // 生成答案
        const answer = await generateAnswer(q.question, q.category);
        
        // 获取嵌入向量
        const embedding = await getEmbedding(`${q.question} ${answer}`);

        documents.push({
          id: q.id || `q-${processed + 1}`,
          embedding,
          question: q.question,
          answer,
          category: q.category,
          source: 'Content-Worker'
        });

        processed++;

        // 批量插入
        if (documents.length >= BATCH_SIZE) {
          console.log(`\n💾 插入 ${documents.length} 条数据到向量数据库...`);
          await insertDocuments(documents);
          documents.length = 0;
          
          // 进度汇报
          const progress = Math.round((processed / allQuestions.length) * 100);
          console.log(`📈 进度: ${progress}% (${processed}/${allQuestions.length})\n`);
        }

        // 延迟，避免 API 限流
        await new Promise(r => setTimeout(r, 500));

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
    console.log('\n📊 统计信息:');
    console.log(`  - 总问题数: ${allQuestions.length}`);
    console.log(`  - 成功导入: ${processed}`);
    console.log(`  - 成功率: ${Math.round((processed / allQuestions.length) * 100)}%`);

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
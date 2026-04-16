// 为 500 个问题生成答案脚本

import '../config/env';
import fs from 'fs';
import path from 'path';
import { callAIGateway } from '../services/ai-gateway.service';

const INPUT_FILE = process.env.INPUT_FILE || path.join(__dirname, '../../../data/qa-pairs-1000.json');
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(__dirname, '../../../data/qa-pairs-with-answers-1000.json');
const BATCH_SIZE = 10;
const DELAY_MS = 1000; // 1秒延迟避免限流

interface QuestionItem {
  id: string;
  question: string;
  category: string;
  priority: string;
  answer?: string;
  disclaimer?: string;
}

// 分类上下文
const CATEGORY_CONTEXT: Record<string, string> = {
  '孕期': '孕期相关问题，包括孕期健康、产检、营养等',
  '育儿': '育儿相关问题，包括新生儿护理、喂养、发育等',
  '营养': '母婴营养相关问题',
  '疫苗': '疫苗接种相关问题',
  '其他': '母婴健康相关问题'
};

// 紧急关键词
const EMERGENCY_KEYWORDS = ['出血', '疼痛', '昏迷', '抽搐', '高烧', '呼吸困难', '流产', '早产'];

// 检测紧急问题
function isEmergency(question: string): boolean {
  return EMERGENCY_KEYWORDS.some(keyword => question.includes(keyword));
}

// 生成答案
async function generateAnswer(item: QuestionItem): Promise<string> {
  const context = CATEGORY_CONTEXT[item.category] || '母婴健康';
  const isUrgent = isEmergency(item.question);
  
  const systemPrompt = `你是一位专业的母婴健康顾问。请简要回答以下${context}问题（150-250字）。

要求：
1. 专业、准确、有同理心
2. 语言通俗易懂
3. 如涉及用药，必须提醒咨询医生
4. 不要给出具体药物剂量
${isUrgent ? '5. 这是一个紧急问题，强调立即就医的重要性' : ''}

⚠️ 免责声明：本回答由 AI 生成，仅供参考，不构成医疗建议。如有健康问题，请咨询专业医生。`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: item.question }
    ];
    
    return await callAIGateway(messages as any);
  } catch (error) {
    console.error(`生成答案失败 [${item.id}]:`, error);
    return '抱歉，暂时无法回答这个问题。请咨询专业医生。';
  }
}

// 主函数
async function generateAnswers() {
  console.log('🚀 开始为 500 个问题生成答案...\n');
  
  // 读取问题
  const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
  const questions: QuestionItem[] = JSON.parse(rawData);
  
  console.log(`📊 读取 ${questions.length} 个问题\n`);
  
  const results: QuestionItem[] = [];
  let processed = 0;
  let successCount = 0;
  
  for (const item of questions) {
    processed++;
    console.log(`📝 [${processed}/${questions.length}] ${item.category} - ${item.question.substring(0, 30)}...`);
    
    try {
      const answer = await generateAnswer(item);
      
      results.push({
        ...item,
        answer,
        disclaimer: '⚠️ 免责声明：本回答由 AI 生成，仅供参考，不构成医疗建议。如有健康问题，请咨询专业医生。'
      });
      
      successCount++;
      
      // 延迟
      if (processed % BATCH_SIZE === 0) {
        console.log(`\n📊 进度: ${Math.round((processed / questions.length) * 100)}% (${processed}/${questions.length})`);
        console.log(`💾 已生成 ${successCount} 个答案\n`);
        
        // 保存中间结果
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
        
        // 延迟避免限流
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
      
    } catch (error) {
      console.error(`❌ 处理失败 [${item.id}]`, error);
      results.push({
        ...item,
        answer: '抱歉，暂时无法回答这个问题。请咨询专业医生。',
        disclaimer: '⚠️ 免责声明：如有健康问题，请咨询专业医生。'
      });
    }
  }
  
  // 最终保存
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
  
  console.log(`\n✅ 完成！`);
  console.log(`📊 统计:`);
  console.log(`  - 总问题数: ${questions.length}`);
  console.log(`  - 成功生成答案: ${successCount}`);
  console.log(`  - 成功率: ${Math.round((successCount / questions.length) * 100)}%`);
  console.log(`\n📁 输出文件: ${OUTPUT_FILE}`);
}

// 执行
generateAnswers()
  .then(() => {
    console.log('\n🎉 所有答案生成完成！');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 生成失败:', error);
    process.exit(1);
  });

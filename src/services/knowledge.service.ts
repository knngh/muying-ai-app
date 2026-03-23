// 知识库服务 - 从JSON文件读取问答数据
import fs from 'fs';
import path from 'path';

interface QAPair {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  target_stage: string[];
  difficulty: string;
  read_time: number;
  author: {
    name: string;
    title: string;
  };
  is_verified: boolean;
  status: string;
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  published_at: string;
  source: string;
  original_id: string;
}

let qaData: QAPair[] = [];
let isLoaded = false;

// 加载知识库数据
export function loadKnowledgeBase(): void {
  try {
    // 尝试多个可能的路径
    const possiblePaths = [
      '/tmp/expanded-qa-data-5000.json',
      path.join(process.cwd(), 'data', 'expanded-qa-data-5000.json'),
      path.join(__dirname, '../../data', 'expanded-qa-data-5000.json'),
    ];

    let dataPath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        dataPath = p;
        break;
      }
    }

    if (!dataPath) {
      console.warn('⚠️ 知识库文件不存在，使用空知识库');
      isLoaded = true;
      return;
    }

    const rawData = fs.readFileSync(dataPath, 'utf-8');
    qaData = JSON.parse(rawData);
    isLoaded = true;
    console.log(`📚 知识库加载成功: ${qaData.length} 条数据 (路径: ${dataPath})`);
  } catch (error) {
    console.error('❌ 知识库加载失败:', error);
    isLoaded = true;
  }
}

// 搜索知识库
export function searchQA(
  query: string,
  options: {
    category?: string;
    limit?: number;
  } = {}
): QAPair[] {
  if (!isLoaded) {
    loadKnowledgeBase();
  }

  const limit = options.limit || 5;
  const queryLower = query.toLowerCase();

  let results = qaData.filter(qa => {
    // 匹配问题或答案
    const matchesQuery = 
      qa.question.toLowerCase().includes(queryLower) ||
      qa.answer.toLowerCase().includes(queryLower);
    
    // 匹配分类（如果指定）
    const matchesCategory = !options.category || qa.category === options.category;
    
    return matchesQuery && matchesCategory;
  });

  // 简单的相关性排序：标题匹配优先
  results.sort((a, b) => {
    const aInQuestion = a.question.toLowerCase().includes(queryLower) ? 1 : 0;
    const bInQuestion = b.question.toLowerCase().includes(queryLower) ? 1 : 0;
    return bInQuestion - aInQuestion;
  });

  return results.slice(0, limit);
}

// 获取相关上下文（用于RAG）
export function getRelatedContext(question: string, topK: number = 3): string {
  const results = searchQA(question, { limit: topK });
  
  if (results.length === 0) {
    return '';
  }

  return results.map((qa, index) => {
    return `[${index + 1}] 问题：${qa.question}\n答案：${qa.answer}`;
  }).join('\n\n');
}

// 获取热门/推荐问题（按浏览量排序，每个分类取一些）
export function getHotQuestions(limit: number = 8): Array<{
  id: string;
  question: string;
  category: string;
}> {
  if (!isLoaded) {
    loadKnowledgeBase();
  }

  // 安全上限
  const safeLimit = Math.min(Math.max(1, limit), 20);

  // 按分类分组，每个分类预排序（使用 slice 避免修改原数组）
  const categoryMap = new Map<string, QAPair[]>();
  qaData.forEach(qa => {
    if (!categoryMap.has(qa.category)) {
      categoryMap.set(qa.category, []);
    }
    categoryMap.get(qa.category)!.push(qa);
  });

  // 每个分类取浏览量最高的，预排序一次
  const sortedByCategory = new Map<string, QAPair[]>();
  for (const [cat, items] of categoryMap) {
    sortedByCategory.set(cat, [...items].sort((a, b) => b.view_count - a.view_count));
  }

  const results: QAPair[] = [];
  const categories = Array.from(sortedByCategory.keys());
  let round = 0;
  const maxRounds = Math.ceil(safeLimit / Math.max(categories.length, 1));

  // 轮询每个分类，确保多样性
  while (results.length < safeLimit && round < maxRounds) {
    for (const cat of categories) {
      if (results.length >= safeLimit) break;
      const sorted = sortedByCategory.get(cat)!;
      if (round < sorted.length) {
        results.push(sorted[round]);
      }
    }
    round++;
  }

  return results.map(qa => ({
    id: qa.id,
    question: qa.question.length > 40 ? qa.question.substring(0, 40) + '...' : qa.question,
    category: qa.category,
  }));
}

// 获取分类列表
export function getCategories(): Array<{ key: string; label: string; count: number }> {
  if (!isLoaded) {
    loadKnowledgeBase();
  }

  const categoryLabels: Record<string, string> = {
    'pregnancy-early': '孕早期',
    'pregnancy-mid': '孕中期',
    'pregnancy-late': '孕晚期',
    'delivery': '分娩',
    'postpartum': '产后恢复',
    'newborn': '新生儿',
    'infant-care': '婴儿护理',
    'nutrition': '营养饮食',
    'mental-health': '心理健康',
    'general': '综合',
  };

  const counts: Record<string, number> = {};
  qaData.forEach(qa => {
    counts[qa.category] = (counts[qa.category] || 0) + 1;
  });

  return Object.entries(counts).map(([key, count]) => ({
    key,
    label: categoryLabels[key] || key,
    count,
  }));
}

// 获取统计信息
export function getKnowledgeStats(): {
  total: number;
  categories: Record<string, number>;
  isLoaded: boolean;
} {
  if (!isLoaded) {
    loadKnowledgeBase();
  }

  const categories: Record<string, number> = {};
  qaData.forEach(qa => {
    categories[qa.category] = (categories[qa.category] || 0) + 1;
  });

  return {
    total: qaData.length,
    categories,
    isLoaded,
  };
}

// 初始化时加载
loadKnowledgeBase();
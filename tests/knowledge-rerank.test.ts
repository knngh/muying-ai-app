import {
  applyKnowledgeRerankOrder,
  parseKnowledgeRerankOutput,
  selectAuthorityPreferredResults,
  shouldShortCircuitKnowledgeAi,
  type KnowledgeSearchResult,
} from '../src/services/knowledge.service';

function buildResult(
  id: string,
  score: number,
  options: {
    question?: string;
    answer?: string;
    category?: string;
    source?: string;
    sourceReference?: Partial<KnowledgeSearchResult['sourceReference']>;
  } = {},
): KnowledgeSearchResult {
  return {
    id,
    question: options.question || `question-${id}`,
    answer: options.answer || `answer-${id}`,
    category: options.category || 'pregnancy-early',
    tags: [],
    difficulty: 'normal',
    read_time: 3,
    author: {
      name: 'Authority',
      title: '权威资料',
    },
    is_verified: true,
    status: 'published',
    view_count: 0,
    like_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    published_at: '2026-01-01T00:00:00.000Z',
    source: options.source || 'CDC',
    original_id: id,
    score,
    sourceReference: {
      title: `title-${id}`,
      source: options.source || 'CDC',
      relevance: 0.8,
      authoritative: true,
      sourceClass: 'official',
      sourceType: 'authority',
      ...options.sourceReference,
    },
    target_stage: [],
  };
}

describe('knowledge rerank helpers', () => {
  it('parses ranked ids from json object output', () => {
    expect(parseKnowledgeRerankOutput('{"ranked_ids":["b","a","c"]}')).toEqual(['b', 'a', 'c']);
  });

  it('parses ranked ids from plain json array output', () => {
    expect(parseKnowledgeRerankOutput('["b","a","c"]')).toEqual(['b', 'a', 'c']);
  });

  it('reorders known ids first and keeps the remaining candidates', () => {
    const results = [
      buildResult('a', 95),
      buildResult('b', 90),
      buildResult('c', 88),
    ];

    expect(applyKnowledgeRerankOrder(results, ['c', 'a'])).toEqual([
      results[2],
      results[0],
      results[1],
    ]);
  });

  it('short-circuits external AI augmentation for strong symptom results', () => {
    const results = [
      {
        ...buildResult('a', 118),
        question: '宝宝发烧怎么办',
        category: 'common-symptoms',
      },
      {
        ...buildResult('b', 103),
        question: '宝宝高烧反复怎么办',
        category: 'parenting-0-1',
      },
    ];

    expect(shouldShortCircuitKnowledgeAi('宝宝发烧怎么办', results)).toBe(true);
    expect(shouldShortCircuitKnowledgeAi('孕晚期脚肿怎么办', [
      {
        ...buildResult('c', 117),
        question: '问题描述：怀孕后期为什么会脚肿',
        category: 'pregnancy-late',
      },
      {
        ...buildResult('d', 111),
        question: '怀孕8个月右脚浮肿怎么办',
        category: 'pregnancy-late',
      },
    ])).toBe(true);
  });

  it('does not short-circuit when symptom results are weak or off-target', () => {
    const results = [
      {
        ...buildResult('a', 52),
        question: 'Pregnancy, breastfeeding and fertility while taking rapid-acting insulin - NHS',
        category: 'pregnancy',
      },
      {
        ...buildResult('b', 41),
        question: 'Termination for fetal anomaly - NHS',
        category: 'newborn',
      },
    ];

    expect(shouldShortCircuitKnowledgeAi('宫缩频繁要去医院吗', results)).toBe(false);
  });

  it('does not short-circuit external augmentation when strong symptom results are dataset-only', () => {
    const datasetSource = {
      source: 'cMedQA2数据集',
      sourceOrg: 'cMedQA2数据集',
      sourceClass: 'dataset' as const,
      sourceType: 'dataset' as const,
      authoritative: false,
    };
    const results = [
      buildResult('dataset-fever-a', 118, {
        question: '宝宝发烧怎么办',
        category: 'common-symptoms',
        source: 'cMedQA2数据集',
        sourceReference: datasetSource,
      }),
      buildResult('dataset-fever-b', 103, {
        question: '宝宝高烧反复怎么办',
        category: 'parenting-0-1',
        source: 'cMedQA2数据集',
        sourceReference: datasetSource,
      }),
    ];

    expect(shouldShortCircuitKnowledgeAi('宝宝发烧怎么办', results)).toBe(false);
  });

  it('prioritizes authority sources for medical and childcare intents while keeping dataset fallback', () => {
    const datasetResult = buildResult('dataset-sleep', 108, {
      question: '宝宝夜醒睡不好怎么办',
      category: 'parenting-0-1',
      source: 'cMedQA2数据集',
      sourceReference: {
        title: '宝宝夜醒睡不好怎么办',
        source: 'cMedQA2数据集',
        sourceOrg: 'cMedQA2数据集',
        sourceClass: 'dataset',
        sourceType: 'dataset',
        authoritative: false,
      },
    });
    const authorityResult = buildResult('authority-sleep', 82, {
      question: '婴幼儿睡眠和夜醒护理',
      category: 'parenting-0-1',
      source: '中国疾控',
      sourceReference: {
        title: '婴幼儿睡眠和夜醒护理',
        source: '中国疾控',
        sourceOrg: '中国疾控',
        sourceClass: 'official',
        sourceType: 'authority',
        authoritative: true,
        region: 'CN',
      },
    });

    expect(selectAuthorityPreferredResults(
      [datasetResult, authorityResult],
      2,
      '宝宝夜醒睡不好怎么办',
    ).map((item) => item.id)).toEqual(['authority-sleep', 'dataset-sleep']);
  });

  it('does not promote policy-like authority content above specific symptom results', () => {
    const policyResult = buildResult('authority-policy', 96, {
      question: '《危重孕产妇救治体系技术评估方案》解读',
      answer: '评估内容、评估程序和组织实施要求。',
      category: 'pregnancy',
      source: '中国政府网政策解读',
      sourceReference: {
        title: '《危重孕产妇救治体系技术评估方案》解读',
        source: '中国政府网政策解读',
        sourceOrg: '中国政府网政策解读',
        sourceClass: 'official',
        sourceType: 'authority',
        authoritative: true,
        region: 'CN',
      },
    });
    const symptomResult = buildResult('dataset-edema', 82, {
      question: '怀孕七个多月，腿浮肿，血压高，尿里有蛋白怎么回事',
      category: 'pregnancy-late',
      source: 'cMedQA2数据集',
      sourceReference: {
        title: '怀孕七个多月腿浮肿',
        source: 'cMedQA2数据集',
        sourceOrg: 'cMedQA2数据集',
        sourceClass: 'dataset',
        sourceType: 'dataset',
        authoritative: false,
      },
    });

    expect(selectAuthorityPreferredResults(
      [policyResult, symptomResult],
      2,
      '孕晚期脚肿怎么办',
    ).map((item) => item.id)).toEqual(['dataset-edema', 'authority-policy']);
  });
});

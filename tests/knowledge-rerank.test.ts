import {
  applyKnowledgeRerankOrder,
  parseKnowledgeRerankOutput,
  shouldShortCircuitKnowledgeAi,
  type KnowledgeSearchResult,
} from '../src/services/knowledge.service';

function buildResult(id: string, score: number): KnowledgeSearchResult {
  return {
    id,
    question: `question-${id}`,
    answer: `answer-${id}`,
    category: 'pregnancy-early',
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
    source: 'CDC',
    original_id: id,
    score,
    sourceReference: {
      title: `title-${id}`,
      source: 'CDC',
      relevance: 0.8,
      authoritative: true,
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
});

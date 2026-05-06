import {
  DEFAULT_KNOWLEDGE_ENRICHMENT_TARGET_CATEGORIES,
  enrichKnowledgeBaseRecords,
} from '../src/utils/knowledge-enrichment';
import type { QAPair } from '../src/services/knowledge.service';

function qaFixture(overrides: Partial<QAPair>): QAPair {
  return {
    id: overrides.id || 'qa-1',
    content_type: 'qa',
    question: overrides.question || '孕早期见红怎么办',
    answer: overrides.answer || '记录出血量和腹痛情况，必要时及时就医。',
    category: overrides.category || 'pregnancy-early',
    tags: overrides.tags || ['母婴'],
    target_stage: overrides.target_stage || [],
    difficulty: 'beginner',
    read_time: 3,
    author: {
      name: 'AI助手',
      title: '智能问答系统',
    },
    is_verified: false,
    status: 'published',
    view_count: 0,
    like_count: 0,
    created_at: '2026-03-16T00:00:00.000Z',
    updated_at: '2026-03-16T00:00:00.000Z',
    published_at: '2026-03-16T00:00:00.000Z',
    source: 'cMedQA2数据集',
    original_id: overrides.id || 'original-1',
    ...overrides,
  };
}

function authorityFixture(overrides: Partial<QAPair>): QAPair {
  return {
    ...qaFixture({
      id: overrides.id || 'authority-acog-1',
      content_type: 'authority',
      question: overrides.question || 'Bleeding during pregnancy',
      answer: overrides.answer || 'Bleeding during pregnancy can need clinical evaluation, especially with pain or heavy bleeding. Contact a health professional for individual care.'.repeat(8),
      category: overrides.category || 'pregnancy',
      tags: overrides.tags || ['孕期与产检'],
      target_stage: overrides.target_stage || ['first-trimester'],
      source: overrides.source || 'ACOG',
      source_org: overrides.source_org || 'ACOG',
      source_id: overrides.source_id || 'acog',
      source_class: overrides.source_class || 'official',
      source_url: overrides.source_url || 'https://www.acog.org/womens-health/faqs/bleeding-during-pregnancy',
      topic: overrides.topic || 'pregnancy',
      audience: overrides.audience || '孕妇',
      region: overrides.region || 'US',
      is_verified: true,
      original_id: overrides.id || 'authority-acog-1',
      ...overrides,
    }),
  };
}

describe('knowledge enrichment', () => {
  it('adds official authority references without marking dataset QA as verified', () => {
    const result = enrichKnowledgeBaseRecords(
      [qaFixture({ id: 'qa-pregnancy-1' })],
      [authorityFixture({ id: 'authority-acog-bleeding' })],
      { now: '2026-05-05T00:00:00.000Z' },
    );

    expect(result.report.enriched).toBe(1);
    expect(result.report.coverageRate).toBe(100);
    expect(result.records[0]?.is_verified).toBe(false);
    expect(result.records[0]?.source_class).toBe('dataset');
    expect(result.records[0]?.references?.[0]).toMatchObject({
      sourceOrg: 'ACOG',
      sourceClass: 'official',
      authoritative: true,
    });
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'matched',
      matchedAt: '2026-05-05T00:00:00.000Z',
    });
  });

  it('does not use medical-platform records when official references are required', () => {
    const result = enrichKnowledgeBaseRecords(
      [qaFixture({ id: 'qa-pregnancy-2' })],
      [
        authorityFixture({
          id: 'authority-youlai-1',
          source_id: 'youlai-pregnancy-guide',
          source_org: '有来医生',
          source: '有来医生',
          source_class: 'medical_platform',
          source_url: 'https://m.youlai.cn/special/advisor/vezz0BpCQ3.html',
        }),
      ],
    );

    expect(result.report.enriched).toBe(0);
    expect(result.records[0]?.references).toBeUndefined();
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'missing',
    });
  });

  it('keeps non-target categories normalized but not authority-covered by default', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-mid-1',
          category: 'pregnancy-mid',
          question: '孕中期胎动少怎么办',
          answer: '记录胎动变化，结合产检和医生建议处理。',
        }),
      ],
      [authorityFixture({ id: 'authority-acog-2' })],
    );

    expect(DEFAULT_KNOWLEDGE_ENRICHMENT_TARGET_CATEGORIES).not.toContain('pregnancy-mid');
    expect(result.report.targetTotal).toBe(0);
    expect(result.records[0]?.references).toBeUndefined();
    expect(result.records[0]?.topic).toBe('pregnancy');
    expect(result.records[0]?.target_stage).toContain('second-trimester');
    expect(result.records[0]?.risk_level_default).toBe('yellow');
  });

  it('penalizes pregnancy authority documents for infant-care QA', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-baby-1',
          category: 'parenting-0-1',
          question: '宝宝夜醒睡不好怎么办',
          answer: '观察吃奶、白天小睡和睡眠环境。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-pregnancy-sleep',
          question: 'Sleep problems during pregnancy',
          answer: 'Sleep problems during pregnancy are common and should be discussed during prenatal visits.'.repeat(8),
          topic: 'pregnancy',
          target_stage: ['first-trimester', 'second-trimester', 'third-trimester'],
        }),
      ],
    );

    expect(result.report.enriched).toBe(0);
    expect(result.records[0]?.references).toBeUndefined();
  });
});

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

  it('covers expanded maternal-child categories by default', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-mid-1',
          category: 'pregnancy-mid',
          question: '孕中期胎动少怎么办',
          answer: '记录胎动变化，结合产检和医生建议处理。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-acog-fetal-movement',
          question: 'Fetal movement in the second trimester',
          answer: 'Fetal movement changes during pregnancy should be discussed during prenatal care, especially if movement seems reduced.'.repeat(8),
          topic: 'pregnancy',
          target_stage: ['second-trimester'],
          tags: ['胎动', '孕中期'],
        }),
      ],
    );

    expect(DEFAULT_KNOWLEDGE_ENRICHMENT_TARGET_CATEGORIES).toContain('pregnancy-mid');
    expect(result.report.targetTotal).toBe(1);
    expect(result.report.enriched).toBe(1);
    expect(result.records[0]?.references?.[0]).toMatchObject({
      sourceOrg: 'ACOG',
      sourceClass: 'official',
      authoritative: true,
    });
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

  it('does not enrich from generic consultation wording alone', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-generic-consult',
          category: 'parenting-0-1',
          question: '医生，宝宝这样是怎么回事，有什么影响，需要治疗吗？',
          answer: '想了解是否需要处理。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-unrelated-baby-condition',
          question: '男宝宝尿道下裂不容忽视',
          answer: '有些家长发现男宝宝尿道口位置异常，医生检查后诊断为尿道下裂，需要由专业医生评估。'.repeat(8),
          topic: 'newborn',
          category: 'newborn',
          target_stage: ['0-6-months'],
          source_id: 'cma-kepu-maternal-child',
          source_org: '中华医学会',
          source: '中华医学会',
          source_url: 'https://www.cma.org.cn/art/2024/11/18/art_4584_59524.html',
        }),
      ],
    );

    expect(result.report.enriched).toBe(0);
    expect(result.records[0]?.references).toBeUndefined();
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'missing',
    });
  });

  it('does not enrich pregnancy QA from trimester wording alone', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-pregnancy-ultrasound',
          category: 'pregnancy-early',
          question: '孕早期 B 超显示胎儿偏小 2 周怎么办？',
          answer: '想了解胎儿发育和复查安排。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-syphilis-screening',
          question: '孕早期为什么要做梅毒筛查？',
          answer: '孕早期产检需要进行梅毒筛查，以便及时发现和规范管理感染风险。'.repeat(8),
          topic: 'pregnancy',
          category: 'pregnancy',
          target_stage: ['first-trimester'],
          tags: ['孕早期', '筛查'],
          source_id: 'cma-kepu-maternal-child',
          source_org: '中华医学会',
          source: '中华医学会',
          source_url: 'https://www.cma.org.cn/art/2024/11/18/art_4584_59523.html',
        }),
      ],
    );

    expect(result.report.enriched).toBe(0);
    expect(result.records[0]?.references).toBeUndefined();
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'missing',
    });
  });

  it('does not enrich child symptom QA from postpartum-specific symptom wording', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-child-cough',
          category: 'parenting-3-6',
          question: '4 岁孩子咳嗽怎么办？',
          answer: '想了解家庭护理和什么时候就医。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-postpartum-incontinence',
          question: '产后咳嗽漏尿是怎么回事？',
          answer: '部分产后女性在咳嗽、运动或用力时会出现漏尿，需要进行盆底功能评估。'.repeat(8),
          topic: 'common-symptoms',
          category: 'postpartum',
          target_stage: ['postpartum'],
          tags: ['产后', '尿失禁', '咳嗽'],
          source_id: 'cma-kepu-maternal-child',
          source_org: '中华医学会',
          source: '中华医学会',
          source_url: 'https://www.cma.org.cn/art/2024/11/18/art_4584_59525.html',
        }),
      ],
    );

    expect(result.report.enriched).toBe(0);
    expect(result.records[0]?.references).toBeUndefined();
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'missing',
    });
  });

  it('matches infant post-vaccination reaction QA to vaccination authority records', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-vaccine-reaction',
          category: 'parenting-0-1',
          question: '五个半月的宝宝今天打完百白破预防针，晚上眼睛周围起了小红疙瘩怎么办？',
          answer: '想了解接种后皮疹和低烧的家庭观察边界。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-msd-vaccine',
          question: '儿童疫苗接种 - 儿童的健康问题',
          answer: '儿童疫苗接种可以预防多种感染。疫苗接种后可能会出现轻微发热、局部红肿等反应，家长应观察精神状态和严重过敏表现。'.repeat(8),
          topic: 'vaccination',
          category: 'vaccination',
          tags: ['疫苗', '婴幼儿家长'],
          target_stage: ['0-6-months', '6-12-months'],
          source_id: 'msd-manuals-cn',
          source_org: 'MSD Manuals',
          source: 'MSD Manuals',
          source_url: 'https://www.msdmanuals.cn/home/children-s-health-issues/vaccination/childhood-vaccination',
        }),
      ],
    );

    expect(result.report.enriched).toBe(1);
    expect(result.records[0]?.references?.[0]).toMatchObject({
      sourceOrg: 'MSD Manuals',
      sourceClass: 'official',
      authoritative: true,
    });
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'matched',
      sourceIds: ['msd-manuals-cn'],
    });
  });

  it('prefers vaccination reaction care records over broad immunization policy pages', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-vaccine-reaction-policy-risk',
          category: 'parenting-0-1',
          question: '五个半月的宝宝今天打完白百破预防针，晚上眼睛周围起了好多小红疙瘩怎么办？',
          answer: '想了解接种后红肿、皮疹和瘙痒的家庭观察边界。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-chinacdc-immunization-plan',
          question: '为贯彻温家宝总理在十届全国人大五次会议上提出的“扩大国家免疫规划范围，将甲肝、流脑等１５种可以通过接种疫苗有效预防的传染病纳入国家免疫规划”的精神，落实扩大国家免疫规划的目标和任务，规范和指导各地科学实施扩大国家免疫规划工作，有效预防和控制相关传染病，制订本方案。',
          answer: '为贯彻扩大国家免疫规划范围要求，明确目标和任务，组织实施免疫程序调整，提高适龄儿童国家免疫规划疫苗接种率。在现行全国范围内使用的乙肝疫苗、卡介苗、脊灰疫苗、百白破疫苗、麻疹疫苗基础上，将甲肝、流脑等疫苗纳入国家免疫规划。'.repeat(8),
          topic: 'vaccination',
          category: 'vaccination',
          tags: ['免疫规划', '百白破', '疫苗'],
          target_stage: ['0-6-months', '6-12-months'],
          source_id: 'chinacdc-immunization',
          source_org: '中国疾病预防控制中心',
          source: '中国疾病预防控制中心',
          source_url: 'https://www.chinacdc.cn/jkyj/mygh02/jswj_mygh/myfw_mygh/202409/t20240925_300934.html',
        }),
        authorityFixture({
          id: 'authority-msd-vaccine-reaction',
          question: '儿童疫苗接种 - 儿童的健康问题',
          summary: '儿童疫苗接种后的常见副作用包括轻微发热、局部红肿、皮疹，家长应观察严重过敏反应和需要就医的情况。',
          answer: '儿童疫苗接种可以预防多种感染。疫苗接种后可能会出现轻微发热、局部红肿、皮疹等反应，家长应观察精神状态和严重过敏表现。'.repeat(8),
          topic: 'vaccination',
          category: 'vaccination',
          tags: ['疫苗', '接种后反应', '婴幼儿家长'],
          target_stage: ['0-6-months', '6-12-months'],
          source_id: 'msd-manuals-cn',
          source_org: 'MSD Manuals',
          source: 'MSD Manuals',
          source_url: 'https://www.msdmanuals.cn/home/children-s-health-issues/vaccination/childhood-vaccination',
        }),
      ],
    );

    expect(result.report.enriched).toBe(1);
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'matched',
      authorityIds: ['authority-msd-vaccine-reaction'],
      sourceIds: ['msd-manuals-cn'],
    });
  });

  it('does not enrich vaccination reaction QA from immunization policy pages alone', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-vaccine-reaction-policy-only',
          category: 'parenting-0-1',
          question: '五个半月的宝宝今天打完白百破预防针，晚上眼睛周围起了好多小红疙瘩怎么办？',
          answer: '想了解接种后红肿、皮疹和瘙痒的家庭观察边界。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-chinacdc-immunization-plan-only',
          question: '为贯彻温家宝总理在十届全国人大五次会议上提出的“扩大国家免疫规划范围，将甲肝、流脑等１５种可以通过接种疫苗有效预防的传染病纳入国家免疫规划”的精神，落实扩大国家免疫规划的目标和任务，规范和指导各地科学实施扩大国家免疫规划工作，有效预防和控制相关传染病，制订本方案。',
          answer: '为贯彻扩大国家免疫规划范围要求，明确目标和任务，组织实施免疫程序调整，提高适龄儿童国家免疫规划疫苗接种率。在现行全国范围内使用的乙肝疫苗、卡介苗、脊灰疫苗、百白破疫苗、麻疹疫苗基础上，将甲肝、流脑等疫苗纳入国家免疫规划。'.repeat(8),
          topic: 'vaccination',
          category: 'vaccination',
          tags: ['免疫规划', '百白破', '疫苗'],
          target_stage: ['0-6-months', '6-12-months'],
          source_id: 'chinacdc-immunization',
          source_org: '中国疾病预防控制中心',
          source: '中国疾病预防控制中心',
          source_url: 'https://www.chinacdc.cn/jkyj/mygh02/jswj_mygh/myfw_mygh/202409/t20240925_300934.html',
        }),
      ],
    );

    expect(result.report.enriched).toBe(0);
    expect(result.records[0]?.references).toBeUndefined();
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'missing',
    });
  });
});

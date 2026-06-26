import {
  generateAuthorityQaTopup,
  type AuthorityTranslationCache,
} from '../src/utils/authority-qa-topup';
import type { QAPair } from '../src/services/knowledge.service';

function qaFixture(overrides: Partial<QAPair> = {}): QAPair {
  return {
    id: overrides.id || 'qa-existing-1',
    content_type: 'qa',
    question: overrides.question || '宝宝发热时家长可以先观察什么？',
    answer: overrides.answer || '观察精神状态、吃奶和体温变化，必要时就医。',
    category: overrides.category || 'common-symptoms',
    tags: overrides.tags || ['母婴'],
    target_stage: overrides.target_stage || ['0-6-months'],
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
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
    published_at: '2026-05-01T00:00:00.000Z',
    source: 'cMedQA2数据集',
    original_id: overrides.id || 'original-existing-1',
    ...overrides,
  };
}

function authorityFixture(overrides: Partial<QAPair> = {}): QAPair {
  return qaFixture({
    id: overrides.id || 'authority-aap-fever',
    content_type: 'authority',
    question: overrides.question || 'Fever and Your Baby',
    answer: overrides.answer || 'Fever can be part of infection. Parents should watch feeding, behavior, and breathing, and contact a clinician when concerned.'.repeat(12),
    category: overrides.category || 'common-symptoms',
    tags: overrides.tags || ['发热'],
    target_stage: overrides.target_stage || ['0-6-months'],
    difficulty: 'authoritative',
    author: {
      name: 'AAP',
      title: 'Authority Source',
    },
    is_verified: true,
    source: overrides.source || 'AAP',
    source_id: overrides.source_id || 'aap',
    source_org: overrides.source_org || 'AAP',
    source_class: overrides.source_class || 'official',
    source_url: overrides.source_url || 'https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/Sleeping-Through-the-Night.aspx',
    url: overrides.url || 'https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/Sleeping-Through-the-Night.aspx',
    audience: overrides.audience || '婴幼儿家长',
    topic: overrides.topic || 'common-symptoms',
    region: overrides.region || 'US',
    original_id: overrides.id || 'authority-aap-fever',
    ...overrides,
  });
}

const translationCache: AuthorityTranslationCache = {
  'authority-aap-fever': {
    translatedTitle: '宝宝发热护理',
    translatedSummary: '美国儿科学会提醒，婴幼儿发热时需要结合月龄、精神状态和吃奶情况综合观察。',
    translatedContent: '家长可以记录体温变化、观察宝宝是否能正常吃奶和睡眠，并留意呼吸、精神状态和尿量。若宝宝状态变差、持续不适或家长难以判断，应及时联系儿科医生。',
  },
};

describe('authority QA top-up', () => {
  it('generates safe Chinese QA records from official authority translations', () => {
    const result = generateAuthorityQaTopup(
      [qaFixture()],
      [authorityFixture()],
      translationCache,
      {
        targetCount: 3,
        now: '2026-05-25T00:00:00.000Z',
        maxGeneratedPerAuthority: 2,
      },
    );

    expect(result.additions).toHaveLength(2);
    expect(result.report.finalTotal).toBe(3);
    expect(result.report.remainingGap).toBe(0);
    expect(result.report.existingDropped).toBe(0);
    expect(result.additions[0]).toMatchObject({
      content_type: 'qa',
      source: '权威资料补齐',
      source_class: 'official',
      source_org: 'AAP',
      status: 'published',
      metadata: {
        generatedBy: 'authority-qa-topup',
        generatedFromAuthorityId: 'authority-aap-fever',
      },
    });
    expect(result.additions[0]?.question).toContain('宝宝');
    expect(result.additions[0]?.answer).toContain('来源：AAP');
    expect(result.additions[0]?.references).toHaveLength(1);
    expect(result.additions[0]?.references?.[0]).toMatchObject({
      sourceOrg: 'AAP',
      sourceClass: 'official',
      authoritative: true,
    });
  });

  it('does not duplicate records when the generated original id already exists', () => {
    const first = generateAuthorityQaTopup(
      [qaFixture()],
      [authorityFixture()],
      translationCache,
      { targetCount: 2, now: '2026-05-25T00:00:00.000Z' },
    );
    const second = generateAuthorityQaTopup(
      first.records,
      [authorityFixture()],
      translationCache,
      { targetCount: 3, now: '2026-05-25T00:00:00.000Z' },
    );

    expect(second.additions).toHaveLength(1);
    expect(new Set(second.records.map((record) => record.id)).size).toBe(second.records.length);
    expect(new Set(second.records.map((record) => record.original_id)).size).toBe(second.records.length);
    expect(second.report.refreshedGenerated).toBe(0);
  });

  it('skips non-official authority records by default', () => {
    const result = generateAuthorityQaTopup(
      [qaFixture()],
      [
        authorityFixture({
          id: 'authority-youlai-fever',
          source: '有来医生',
          source_org: '有来医生',
          source_id: 'youlai',
          source_class: 'medical_platform',
          source_url: 'https://m.youlai.cn/article/123.html',
          url: 'https://m.youlai.cn/article/123.html',
          question: '宝宝发热护理',
        }),
      ],
      {
        'authority-youlai-fever': {
          translatedTitle: '宝宝发热护理',
          translatedSummary: '婴幼儿发热时需要观察精神状态和吃奶情况。',
          translatedContent: '家长应记录体温变化，结合宝宝月龄和状态决定是否咨询医生。',
        },
      },
      { targetCount: 2 },
    );

    expect(result.additions).toHaveLength(0);
    expect(result.report.skipped.not_official).toBe(1);
  });

  it('requires Chinese material by default to avoid English-only QA answers', () => {
    const result = generateAuthorityQaTopup(
      [qaFixture()],
      [authorityFixture()],
      {},
      { targetCount: 2 },
    );

    expect(result.additions).toHaveLength(0);
    expect(result.report.skipped.missing_chinese_material).toBe(1);
  });

  it('keeps already complete datasets unchanged', () => {
    const existing = [
      qaFixture({ id: 'qa-1', original_id: 'qa-1' }),
      qaFixture({ id: 'qa-2', original_id: 'qa-2', question: '孕期发热时可以先观察什么？' }),
    ];
    const result = generateAuthorityQaTopup(
      existing,
      [authorityFixture()],
      translationCache,
      { targetCount: 2 },
    );

    expect(result.additions).toHaveLength(0);
    expect(result.records).toBe(existing);
    expect(result.report.needed).toBe(0);
  });

  it('cleans existing records that fail the dataset guard before topping up', () => {
    const unsafe = qaFixture({
      id: 'qa-unsafe',
      original_id: 'qa-unsafe',
      question: '青春期孩子近视防控怎么办？',
    });
    const result = generateAuthorityQaTopup(
      [qaFixture(), unsafe],
      [authorityFixture()],
      translationCache,
      { targetCount: 2, now: '2026-05-25T00:00:00.000Z' },
    );

    expect(result.report.existing).toBe(2);
    expect(result.report.existingKept).toBe(1);
    expect(result.report.existingDropped).toBe(1);
    expect(result.records.some((record) => record.id === 'qa-unsafe')).toBe(false);
    expect(result.records).toHaveLength(2);
  });

  it('keeps child medication top-up records out of pregnancy nutrition context', () => {
    const result = generateAuthorityQaTopup(
      [qaFixture()],
      [
        authorityFixture({
          id: 'authority-fda-child-ibuprofen',
          question: 'Ibuprofen for Children: Medicine for pain and fever',
          answer: 'Ibuprofen can help reduce pain and fever in children. Families should follow product directions and ask a clinician when a child is very young, symptoms persist, or warning signs appear.'.repeat(12),
          category: 'nutrition-pregnancy',
          topic: 'feeding',
          target_stage: ['first-trimester', 'second-trimester', 'third-trimester'],
          audience: '母婴家庭',
          source: 'FDA',
          source_id: 'fda',
          source_org: 'FDA',
          source_url: 'https://www.fda.gov/drugs/information-drug-class/ibuprofen-children',
          url: 'https://www.fda.gov/drugs/information-drug-class/ibuprofen-children',
        }),
      ],
      {
        'authority-fda-child-ibuprofen': {
          translatedTitle: '儿童用布洛芬：用于缓解疼痛和退烧的药物',
          translatedSummary: '布洛芬可用于缓解儿童疼痛和发热，家长需要阅读说明并关注年龄、症状持续时间和警示表现。',
          translatedContent: '儿童使用退烧或止痛药时，应结合孩子年龄、体重、精神状态和症状变化判断。若孩子很小、发热持续、精神变差或家长拿不准，应及时咨询儿科医生。',
        },
      },
      {
        targetCount: 2,
        now: '2026-05-25T00:00:00.000Z',
        maxGeneratedPerAuthority: 1,
      },
    );

    expect(result.additions).toHaveLength(1);
    expect(result.additions[0]).toMatchObject({
      category: 'common-symptoms',
      topic: 'feeding',
    });
    expect(result.additions[0]?.question).toContain('宝宝护理中');
    expect(result.additions[0]?.question).not.toContain('孕期营养安排中');
    expect(result.additions[0]?.answer).toContain('儿科医生');
  });

  it('does not reclassify vague translated titles from pregnancy nutrition to child care', () => {
    const result = generateAuthorityQaTopup(
      [qaFixture()],
      [
        authorityFixture({
          id: 'authority-nhs-vague-title',
          question: 'Vague feeding guidance',
          answer: 'This general feeding article mentions that families should ask a clinician if a baby has fever or needs medication guidance.'.repeat(12),
          category: 'nutrition-pregnancy',
          topic: 'feeding',
          target_stage: ['first-trimester', 'second-trimester', 'third-trimester'],
          audience: '母婴家庭',
          source: 'NHS',
          source_id: 'nhs',
          source_org: 'NHS',
          source_url: 'https://www.nhs.uk/example/vague-feeding-guidance',
          url: 'https://www.nhs.uk/example/vague-feeding-guidance',
        }),
      ],
      {
        'authority-nhs-vague-title': {
          translatedTitle: '译后的标题',
          translatedSummary: '这是一段一般性的喂养和家庭观察资料，其中提到宝宝发热或用药问题需要咨询专业人员。',
          translatedContent: '资料面向家庭提供一般提醒，也提到儿童、宝宝、发热、用药等词，但标题本身没有明确指向儿童用药或退烧药。',
        },
      },
      {
        targetCount: 2,
        now: '2026-05-25T00:00:00.000Z',
        maxGeneratedPerAuthority: 1,
      },
    );

    expect(result.additions).toHaveLength(1);
    expect(result.additions[0]).toMatchObject({
      category: 'nutrition-pregnancy',
      topic: 'feeding',
    });
    expect(result.additions[0]?.question).toContain('孕期营养安排中');
  });

  it('refreshes existing generated top-up records when source classification changes', () => {
    const staleGenerated = qaFixture({
      id: 'qa-authority-topup-stale-key-points',
      original_id: 'authority-topup:authority-fda-child-ibuprofen:key-points',
      question: '孕期营养安排中，关于《儿童用布洛芬：用于缓解疼痛和退烧的药物》需要了解哪些要点？',
      answer: '根据 FDA 资料整理，旧内容。',
      category: 'nutrition-pregnancy',
      topic: 'feeding',
      source: '权威资料补齐',
      source_class: 'official',
      metadata: {
        generatedBy: 'authority-qa-topup',
        generatedFromAuthorityId: 'authority-fda-child-ibuprofen',
        generatedTemplate: 'key-points',
      },
    });

    const result = generateAuthorityQaTopup(
      [qaFixture(), staleGenerated],
      [
        authorityFixture({
          id: 'authority-fda-child-ibuprofen',
          question: 'Ibuprofen for Children: Medicine for pain and fever',
          answer: 'Ibuprofen can help reduce pain and fever in children. Families should follow product directions and ask a clinician when warning signs appear.'.repeat(12),
          category: 'nutrition-pregnancy',
          topic: 'feeding',
          target_stage: ['first-trimester', 'second-trimester', 'third-trimester'],
          audience: '母婴家庭',
          source: 'FDA',
          source_id: 'fda',
          source_org: 'FDA',
          source_url: 'https://www.fda.gov/drugs/information-drug-class/ibuprofen-children',
          url: 'https://www.fda.gov/drugs/information-drug-class/ibuprofen-children',
        }),
      ],
      {
        'authority-fda-child-ibuprofen': {
          translatedTitle: '儿童用布洛芬：用于缓解疼痛和退烧的药物',
          translatedSummary: '布洛芬可用于缓解儿童疼痛和发热，家长需要阅读说明并关注年龄、症状持续时间和警示表现。',
          translatedContent: '儿童使用退烧或止痛药时，应结合孩子年龄、体重、精神状态和症状变化判断。若孩子很小、发热持续、精神变差或家长拿不准，应及时咨询儿科医生。',
        },
      },
      {
        targetCount: 2,
        now: '2026-05-25T00:00:00.000Z',
        maxGeneratedPerAuthority: 1,
      },
    );

    const refreshed = result.records.find((record) => record.original_id === staleGenerated.original_id);
    expect(result.additions).toHaveLength(0);
    expect(result.report.refreshedGenerated).toBe(1);
    expect(result.records).toHaveLength(2);
    expect(refreshed).toMatchObject({
      category: 'common-symptoms',
      topic: 'feeding',
      created_at: staleGenerated.created_at,
    });
    expect(refreshed?.question).toContain('宝宝护理中');
    expect(refreshed?.question).not.toContain('孕期营养安排中');
  });

  it('drops stale child medication QA and regenerates it from the correct source', () => {
    const staleGenerated = qaFixture({
      id: 'qa-authority-topup-stale-ibuprofen-key-points',
      original_id: 'authority-topup:authority-nhs-mebendazole:key-points',
      question: '宝宝护理中，关于《儿童用布洛芬：用于缓解疼痛和退烧的药物》需要了解哪些要点？',
      answer: '根据 NHS 资料整理，旧内容。',
      category: 'common-symptoms',
      topic: 'feeding',
      target_stage: ['first-trimester', 'second-trimester', 'third-trimester'],
      source: '权威资料补齐',
      source_id: 'nhs',
      source_org: 'NHS',
      source_class: 'official',
      source_url: 'https://www.nhs.uk/medicines/mebendazole/pregnancy-breastfeeding-and-fertility-while-taking-mebendazole/',
      url: 'https://www.nhs.uk/medicines/mebendazole/pregnancy-breastfeeding-and-fertility-while-taking-mebendazole/',
      references: [
        {
          title: '儿童用布洛芬：用于缓解疼痛和退烧的药物',
          url: 'https://www.nhs.uk/medicines/mebendazole/pregnancy-breastfeeding-and-fertility-while-taking-mebendazole/',
          org: 'NHS',
          sourceOrg: 'NHS',
          sourceClass: 'official',
          authoritative: true,
        },
      ],
      metadata: {
        generatedBy: 'authority-qa-topup',
        generatedFromAuthorityId: 'authority-nhs-mebendazole',
        generatedTemplate: 'key-points',
      },
    });

    const result = generateAuthorityQaTopup(
      [qaFixture(), staleGenerated],
      [
        authorityFixture({
          id: 'authority-nhs-mebendazole',
          question: 'Pregnancy, breastfeeding and fertility while taking mebendazole',
          answer: 'Mebendazole can be used during pregnancy if necessary. Ask a doctor or midwife about medicines during pregnancy and breastfeeding.'.repeat(12),
          category: 'feeding',
          topic: 'feeding',
          target_stage: ['first-trimester', 'second-trimester', 'third-trimester'],
          audience: '孕妇',
          source: 'NHS',
          source_id: 'nhs',
          source_org: 'NHS',
          source_url: 'https://www.nhs.uk/medicines/mebendazole/pregnancy-breastfeeding-and-fertility-while-taking-mebendazole/',
          url: 'https://www.nhs.uk/medicines/mebendazole/pregnancy-breastfeeding-and-fertility-while-taking-mebendazole/',
        }),
        authorityFixture({
          id: 'authority-nhs-child-ibuprofen',
          question: 'Ibuprofen for children: medicine for pain and high temperature',
          answer: 'Ibuprofen for children can treat pain and high temperature. Families should follow the medicine instructions and ask a clinician when symptoms persist or warning signs appear.'.repeat(12),
          category: 'common-symptoms',
          topic: 'common-symptoms',
          target_stage: ['0-6-months', '6-12-months'],
          audience: '婴幼儿家长',
          source: 'NHS',
          source_id: 'nhs',
          source_org: 'NHS',
          source_url: 'https://www.nhs.uk/medicines/ibuprofen-for-children/',
          url: 'https://www.nhs.uk/medicines/ibuprofen-for-children/',
        }),
      ],
      {
        'authority-nhs-mebendazole': {
          translatedTitle: '儿童用布洛芬：用于缓解疼痛和退烧的药物',
          translatedSummary: 'NHS提供的关于儿童用布洛芬的药物信息。',
          translatedContent: '儿童用布洛芬可用于缓解疼痛和发热。',
        },
        'authority-nhs-child-ibuprofen': {
          translatedTitle: '儿童用布洛芬：用于缓解疼痛和退烧的药物',
          translatedSummary: 'NHS提供的关于儿童用布洛芬的药物信息——包括其用途、副作用、用法用量以及适用人群。',
          translatedContent: '儿童用布洛芬可以帮助缓解疼痛和发热。家长应阅读说明，并在症状持续、孩子年龄较小或拿不准时咨询医生。',
        },
      },
      {
        targetCount: 2,
        now: '2026-05-25T00:00:00.000Z',
        maxGeneratedPerAuthority: 1,
      },
    );

    expect(result.additions).toHaveLength(1);
    expect(result.report.existingDropped).toBe(1);
    expect(result.report.refreshedGenerated).toBe(0);
    expect(result.report.skipped.translation_title_lifecycle_mismatch).toBe(1);
    expect(result.records.some((record) => record.id === staleGenerated.id)).toBe(false);
    expect(result.additions[0]).toMatchObject({
      original_id: 'authority-topup:authority-nhs-child-ibuprofen:key-points',
      category: 'common-symptoms',
      source_url: 'https://www.nhs.uk/medicines/ibuprofen-for-children/',
      url: 'https://www.nhs.uk/medicines/ibuprofen-for-children/',
      target_stage: ['0-6-months', '6-12-months'],
    });
    expect(result.additions[0]?.references?.[0]).toMatchObject({
      title: '儿童用布洛芬：用于缓解疼痛和退烧的药物',
      url: 'https://www.nhs.uk/medicines/ibuprofen-for-children/',
    });
  });

  it('drops stale duplicate child medication QA when the correct source record already exists', () => {
    const staleGenerated = qaFixture({
      id: 'qa-authority-topup-stale-ibuprofen-key-points',
      original_id: 'authority-topup:authority-nhs-mebendazole:key-points',
      question: '宝宝护理中，关于《儿童用布洛芬：用于缓解疼痛和退烧的药物》需要了解哪些要点？',
      answer: '根据 NHS 资料整理，旧内容。',
      category: 'common-symptoms',
      topic: 'feeding',
      target_stage: ['first-trimester', 'second-trimester', 'third-trimester'],
      source: '权威资料补齐',
      source_id: 'nhs',
      source_org: 'NHS',
      source_class: 'official',
      source_url: 'https://www.nhs.uk/medicines/mebendazole/pregnancy-breastfeeding-and-fertility-while-taking-mebendazole/',
      url: 'https://www.nhs.uk/medicines/mebendazole/pregnancy-breastfeeding-and-fertility-while-taking-mebendazole/',
      references: [
        {
          title: '儿童用布洛芬：用于缓解疼痛和退烧的药物',
          url: 'https://www.nhs.uk/medicines/mebendazole/pregnancy-breastfeeding-and-fertility-while-taking-mebendazole/',
          org: 'NHS',
          sourceOrg: 'NHS',
          sourceClass: 'official',
          authoritative: true,
        },
      ],
      metadata: {
        generatedBy: 'authority-qa-topup',
        generatedFromAuthorityId: 'authority-nhs-mebendazole',
        generatedTemplate: 'key-points',
      },
    });
    const correctGenerated = qaFixture({
      id: 'qa-authority-topup-correct-ibuprofen-key-points',
      original_id: 'authority-topup:authority-nhs-child-ibuprofen:key-points',
      question: staleGenerated.question,
      answer: '根据 NHS 正确儿童布洛芬页面整理。',
      category: 'common-symptoms',
      topic: 'common-symptoms',
      target_stage: ['0-6-months', '6-12-months'],
      source: '权威资料补齐',
      source_id: 'nhs',
      source_org: 'NHS',
      source_class: 'official',
      source_url: 'https://www.nhs.uk/medicines/ibuprofen-for-children/',
      url: 'https://www.nhs.uk/medicines/ibuprofen-for-children/',
      references: [
        {
          title: '儿童用布洛芬：用于缓解疼痛和退烧的药物',
          url: 'https://www.nhs.uk/medicines/ibuprofen-for-children/',
          org: 'NHS',
          sourceOrg: 'NHS',
          sourceClass: 'official',
          authoritative: true,
        },
      ],
      metadata: {
        generatedBy: 'authority-qa-topup',
        generatedFromAuthorityId: 'authority-nhs-child-ibuprofen',
        generatedTemplate: 'key-points',
      },
    });

    const result = generateAuthorityQaTopup(
      [qaFixture(), staleGenerated, correctGenerated],
      [authorityFixture({
        id: 'authority-aap-fever',
        question: 'Fever care for babies',
        answer: 'Parents can track fever, feeding, and behavior, and contact a clinician when warning signs appear.'.repeat(12),
      })],
      translationCache,
      {
        targetCount: 3,
        now: '2026-05-25T00:00:00.000Z',
        maxGeneratedPerAuthority: 1,
      },
    );

    expect(result.report.existing).toBe(3);
    expect(result.report.existingDropped).toBe(1);
    expect(result.records.some((record) => record.id === staleGenerated.id)).toBe(false);
    expect(result.records.some((record) => record.id === correctGenerated.id)).toBe(true);
    expect(result.records).toHaveLength(3);
    expect(result.records).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        source_url: expect.stringContaining('pregnancy-breastfeeding-and-fertility'),
      }),
    ]));
  });
});

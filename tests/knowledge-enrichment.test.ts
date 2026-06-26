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
      answer: overrides.answer || 'Bleeding during pregnancy can need clinical evaluation, especially with pain or heavy bleeding. Contact a health professional for individual care.'.repeat(12),
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
          answer: 'Fetal movement changes during pregnancy should be discussed during prenatal care, especially if movement seems reduced.'.repeat(12),
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

  it('matches fetal movement decline QA to pregnancy authority body text', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-pregnancy-fetal-movement-reduced',
          category: 'pregnancy-mid',
          question: '怀孕八个月了，宝宝胎动次数减少，前几天感冒来，有关系吗？',
          answer: '想了解胎动变化和什么时候需要联系医生。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-msd-fetal-movement',
          question: 'Pregnancy week-by-week guidance',
          summary: 'General late pregnancy observation guidance.',
          answer: 'If fetal movements seem decreased or reduced, contact a health professional for pregnancy care. 胎动明显减少或消失需要及时联系医生。'.repeat(8),
          topic: 'pregnancy',
          category: 'pregnancy',
          tags: ['孕期'],
          target_stage: ['second-trimester', 'third-trimester'],
          source_id: 'msd-manuals-cn',
          source_org: 'MSD Manuals',
          source: 'MSD Manuals',
          source_url: 'https://www.msdmanuals.cn/home/women-s-health-issues/normal-pregnancy',
        }),
      ],
    );

    expect(result.report.enriched).toBe(1);
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'matched',
      authorityIds: ['authority-msd-fetal-movement'],
      sourceIds: ['msd-manuals-cn'],
    });
  });

  it('does not enrich fetal movement QA from generic pregnancy symptom wording', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-pregnancy-fetal-movement-incidental-cold',
          category: 'pregnancy-mid',
          question: '怀孕八个月了，宝宝胎动次数减少，前几天感冒来，有关系吗？',
          answer: '想了解胎动减少是否和感冒有关。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-nhs-morning-sickness',
          question: 'Vomiting and morning sickness',
          summary: 'NHS explains nausea and vomiting during pregnancy.',
          answer: 'Nausea and vomiting can happen during pregnancy. People with cold or flu symptoms can ask a midwife or doctor about medicines in pregnancy.'.repeat(8),
          topic: 'pregnancy',
          category: 'pregnancy',
          tags: ['孕期'],
          target_stage: ['first-trimester', 'second-trimester', 'third-trimester'],
          source_id: 'nhs',
          source_org: 'NHS',
          source: 'NHS',
          source_url: 'https://www.nhs.uk/pregnancy/common-symptoms/vomiting-and-morning-sickness/',
        }),
      ],
    );

    expect(result.report.enriched).toBe(0);
    expect(result.records[0]?.references).toBeUndefined();
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'missing',
    });
  });

  it('matches contraction and labor QA to pregnancy authority body text', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-pregnancy-false-labor',
          category: 'pregnancy-late',
          question: '快到预产期了，假宫缩和临产怎么区分？',
          answer: '想了解假宫缩、规律宫缩和出现临产信号时的就医边界。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-acog-labor-signs-policy',
          question: 'Use of Nitrous Oxide in Labor and Delivery',
          answer: 'This policy page discusses labor analgesia, delivery medication, and professional practice details.'.repeat(8),
          topic: 'policy',
          category: 'policy',
          target_stage: ['third-trimester'],
          source_id: 'acog',
          source_org: 'ACOG',
          source: 'ACOG',
          source_url: 'https://www.acog.org/clinical/clinical-guidance/practice-advisory/articles/2021/07/use-of-nitrous-oxide-in-labor',
        }),
        authorityFixture({
          id: 'authority-msd-labor-signs',
          question: 'Late pregnancy observation guidance',
          summary: 'General guidance for the final weeks of pregnancy.',
          answer: 'Braxton Hicks contractions are sometimes called false labor. Labor signs can include regular contractions, water breaking, or bloody show near delivery. 假宫缩和临产信号需要结合宫缩规律、破水和见红观察。'.repeat(8),
          topic: 'pregnancy',
          category: 'pregnancy',
          tags: ['孕晚期'],
          target_stage: ['third-trimester'],
          source_id: 'msd-manuals-cn',
          source_org: 'MSD Manuals',
          source: 'MSD Manuals',
          source_url: 'https://www.msdmanuals.cn/home/women-s-health-issues/normal-labor-and-delivery',
        }),
      ],
    );

    expect(result.report.enriched).toBe(1);
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'matched',
      authorityIds: ['authority-msd-labor-signs'],
      sourceIds: ['msd-manuals-cn'],
    });
  });

  it('matches formula spit-up QA to infant feeding authority records', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-formula-spit-up',
          category: 'nutrition-baby',
          question: '宝宝喝奶粉后经常吐奶怎么办？',
          answer: '想了解配方奶喂养后吐奶的观察和护理边界。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-aap-spit-up',
          question: 'Baby Burping, Hiccups & Spit-Up',
          summary: 'AAP explains burping during feedings and how to handle hiccups and spitting up.',
          answer: 'Young babies may swallow air during feedings, including bottle feeding. Burping and feeding pauses can help, and parents should watch for warning signs when spit-up is frequent or forceful.'.repeat(8),
          topic: 'feeding',
          category: 'feeding',
          tags: ['喂养', '婴幼儿家长'],
          target_stage: ['0-6-months', '6-12-months'],
          source_id: 'aap',
          source_org: 'AAP',
          source: 'AAP',
          source_url: 'https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Burping-Hiccups-and-Spit-Up.aspx',
        }),
      ],
    );

    expect(result.report.enriched).toBe(1);
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'matched',
      authorityIds: ['authority-aap-spit-up'],
      sourceIds: ['aap'],
    });
  });

  it('does not enrich infant symptom QA from generic formula wording alone', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-formula-incidental-symptom',
          category: 'nutrition-baby',
          question: '宝宝两个月了，有个鼻孔老是流鼻血，吃的是奶粉，会不会是吃奶粉引起的？',
          answer: '想了解鼻出血和奶粉是否有关。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-aap-formula-forms',
          question: 'Forms of Baby Formula: Powder, Concentrate & Ready-to-Feed',
          summary: 'AAP explains common baby formula forms and preparation differences.',
          answer: 'Baby formula comes in several forms, including powder, concentrate, and ready-to-feed products. Families should follow preparation instructions and safe storage guidance.'.repeat(8),
          topic: 'feeding',
          category: 'feeding',
          tags: ['喂养', '婴幼儿家长'],
          target_stage: ['0-6-months', '6-12-months'],
          source_id: 'aap',
          source_org: 'AAP',
          source: 'AAP',
          source_url: 'https://www.healthychildren.org/English/ages-stages/baby/formula-feeding/Pages/Forms-of-Baby-Formula.aspx',
        }),
        authorityFixture({
          id: 'authority-aap-responsive-feeding',
          question: 'Is Your Baby Hungry or Full? Responsive Feeding Explained',
          summary: 'AAP explains responsive feeding cues during breastfeeding, bottle feeding, and formula feeding.',
          answer: 'Responsive feeding helps families notice hunger and fullness cues during breastfeeding, bottle feeding, and formula feeding. It does not cover nosebleeds or unrelated symptom causes.'.repeat(8),
          topic: 'feeding',
          category: 'feeding',
          tags: ['喂养', '婴幼儿家长'],
          target_stage: ['0-6-months', '6-12-months'],
          source_id: 'aap',
          source_org: 'AAP',
          source: 'AAP',
          source_url: 'https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Is-Your-Baby-Hungry-or-Full-Responsive-Feeding-Explained.aspx',
        }),
        authorityFixture({
          id: 'authority-aap-vitamin-d-incidental',
          question: 'Where We Stand: Vitamin D & Iron Supplements for Babies',
          summary: 'AAP discusses vitamin d and iron supplements for infants and nursing mothers.',
          answer: 'Vitamin D and iron supplementation can be discussed with a pediatrician for infants. This page is not about nosebleeds or formula-related symptom attribution.'.repeat(8),
          topic: 'feeding',
          category: 'feeding',
          tags: ['喂养', '婴幼儿家长'],
          target_stage: ['0-6-months', '6-12-months'],
          source_id: 'aap',
          source_org: 'AAP',
          source: 'AAP',
          source_url: 'https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Vitamin-D-Iron-Supplements.aspx',
        }),
      ],
    );

    expect(result.report.enriched).toBe(0);
    expect(result.records[0]?.references).toBeUndefined();
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'missing',
    });
  });

  it('matches colloquial vitamin d supplement QA to infant nutrition authority records', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-vitamin-d-fish-oil',
          category: 'nutrition-baby',
          question: '宝宝纯母乳喂养需要补充鱼肝油吗？',
          answer: '想了解纯母乳喂养宝宝是否需要维生素D补充。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-aap-vitamin-d',
          question: 'Where We Stand: Vitamin D & Iron Supplements for Babies',
          summary: 'AAP discusses vitamin d and iron supplements for infants, children, and nursing mothers.',
          answer: 'The American Academy of Pediatrics discusses vitamin D and iron supplements for babies, including infants who are breastfed and may need supplementation based on pediatric guidance.'.repeat(8),
          topic: 'feeding',
          category: 'feeding',
          tags: ['喂养', '婴幼儿家长'],
          target_stage: ['0-6-months', '6-12-months'],
          source_id: 'aap',
          source_org: 'AAP',
          source: 'AAP',
          source_url: 'https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Vitamin-D-Iron-Supplements.aspx',
        }),
      ],
    );

    expect(result.report.enriched).toBe(1);
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'matched',
      authorityIds: ['authority-aap-vitamin-d'],
      sourceIds: ['aap'],
    });
  });

  it('matches infant motor milestone concerns to child development authority records', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-infant-motor-milestone',
          category: 'parenting-0-1',
          question: '宝宝8个月不会主动伸手拿东西，坐不稳怎么办？',
          answer: '想了解大运动和精细动作发育里程碑，以及什么时候咨询医生。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-cdc-development-concern',
          question: 'Concerned About Your Child’s Development?',
          summary: 'CDC explains what to do if a child is not meeting milestones and when to ask for developmental screening.',
          answer: 'If your child is not meeting milestones for their age or if you have concerns about development, talk with your child’s doctor and ask about developmental screening and early supports.'.repeat(8),
          topic: 'development',
          category: 'development',
          tags: ['成长发育', '婴幼儿家长'],
          target_stage: ['0-6-months', '6-12-months'],
          source_id: 'cdc',
          source_org: 'CDC',
          source: 'CDC',
          source_url: 'https://www.cdc.gov/ncbddd/actearly/concerned.html',
        }),
      ],
    );

    expect(result.report.enriched).toBe(1);
    expect(result.records[0]?.metadata?.authorityCoverage).toMatchObject({
      status: 'matched',
      authorityIds: ['authority-cdc-development-concern'],
      sourceIds: ['cdc'],
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

  it('does not enrich vaccination reaction QA from vaccine schedule pages alone', () => {
    const result = enrichKnowledgeBaseRecords(
      [
        qaFixture({
          id: 'qa-vaccine-reaction-schedule-only',
          category: 'parenting-0-1',
          question: '5个月宝宝打完百白破反复低烧怎么办？',
          answer: '想了解接种后低烧和红肿的观察边界。',
        }),
      ],
      [
        authorityFixture({
          id: 'authority-ndcpa-vaccine-schedule-only',
          question: '这4种孩子必打的疫苗，家长要记好（附具体接种时间）',
          summary: '乙肝疫苗与卡介苗在新生儿出生伊始帮助对抗肝炎与结核病威胁；流脑疫苗抵御细菌性脑膜炎；麻腮风三联疫苗预防麻疹、腮腺炎和风疹。以下分别介绍这几种疫苗可预防的疾病以及接种方案。',
          answer: '及时接种关键疫苗，是构筑儿童免疫防线的重要步骤。如何接种乙肝疫苗？按照免疫规划接种程序，新生儿在出生后24小时内接种第一针，满月时接种第二针，6月龄时接种第三针。流行性脑脊髓膜炎可出现发热和皮疹，麻腮风疫苗可预防相关传染病。'.repeat(8),
          topic: 'vaccination',
          category: 'vaccination',
          tags: ['疫苗', '婴幼儿家长'],
          target_stage: ['0-6-months', '6-12-months'],
          source_id: 'ndcpa-immunization',
          source_org: '国家疾病预防控制局',
          source: '国家疾病预防控制局',
          source_url: 'https://www.ndcpa.gov.cn/jbkzzx/c100040/common/content/content_1937753268497584128.html',
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

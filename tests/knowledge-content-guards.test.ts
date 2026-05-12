import {
  containsDeathRelatedTerms,
  getAuthorityKnowledgeDropReason,
  getDatasetKnowledgeDropReason,
  isOutOfScopeKnowledgeQuery,
} from '../src/utils/knowledge-content-guard';
import { searchQA } from '../src/services/knowledge.service';

describe('knowledge content guards', () => {
  it('rejects dataset records outside the maternal-infant app scope', () => {
    expect(getDatasetKnowledgeDropReason({
      question: '全部症状：怕冷，阳痿早泄，痰多，皮肤发紫',
      answer: '症状处理建议',
      category: 'common-symptoms',
      tags: ['母婴'],
    })).toBe('missing_product_scope');

    expect(getDatasetKnowledgeDropReason({
      question: '女我今年31岁了从小胸就小，想试试手术隆胸',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('missing_product_scope');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝发烧怎么办',
      answer: '发热时观察体温、精神状态和进食情况。',
      category: 'common-symptoms',
      tags: ['母婴'],
    })).toBeNull();

    expect(getDatasetKnowledgeDropReason({
      question: '孕吐什么时候需要就医？',
      answer: '观察孕吐频率、饮水和尿量，必要时就医。',
      category: 'pregnancy-early',
      tags: ['母婴'],
    })).toBeNull();
  });

  it('rejects adolescent, research, and high-sensitivity dataset records', () => {
    expect(getDatasetKnowledgeDropReason({
      question: '孩子青春期发育太快怎么办',
      answer: '青春期发育建议',
      category: 'common-development',
    })).toBe('beyond_app_child_age');

    expect(getDatasetKnowledgeDropReason({
      question: '中文调研问卷和母婴小程序有什么关系',
      answer: '调查问卷',
      category: 'common-symptoms',
    })).toBe('non_content_or_research');

    expect(getDatasetKnowledgeDropReason({
      question: '怀孕六个月胎儿畸形，医生建议引产怎么办',
      answer: '症状处理建议',
      category: 'pregnancy-mid',
    })).toBe('high_sensitivity_dataset_topic');

    expect(getDatasetKnowledgeDropReason({
      question: '怀孕后胎停会不会导致死胎',
      answer: '症状处理建议',
      category: 'pregnancy-early',
    })).toBe('high_sensitivity_dataset_topic');

    expect(getDatasetKnowledgeDropReason({
      question: '怀孕两个月想吃药打掉孩子怎么办',
      answer: '症状处理建议',
      category: 'pregnancy-early',
    })).toBe('high_sensitivity_dataset_topic');

    expect(getDatasetKnowledgeDropReason({
      question: '由于工作原因，不想要孩子如果不想保留，喝酒能否导致坠胎？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
    })).toBe('high_sensitivity_dataset_topic');

    expect(getDatasetKnowledgeDropReason({
      question: '37岁怀孕快5个月，晚上睡觉腰部和大腿疼痛，胎动比白天频繁',
      answer: '症状处理建议',
      category: 'pregnancy-mid',
    })).toBeNull();

    expect(getDatasetKnowledgeDropReason({
      question: '28岁了早上拉大便时有虫子小孩还在吃奶可以吃药吗',
      answer: '哺乳期用药建议',
      category: 'nutrition-baby',
    })).toBeNull();
  });

  it('rejects dataset records assigned to the wrong lifecycle category', () => {
    expect(getDatasetKnowledgeDropReason({
      question: '我家8岁小孩为什么总是嘴巴子红',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('beyond_app_child_age');

    expect(getDatasetKnowledgeDropReason({
      question: '我的孩子20了可老感冒发烧还有时咳嗽吃药打针',
      answer: '症状处理建议',
      category: 'vaccine-reaction',
      tags: ['母婴'],
    })).toBe('beyond_app_child_age');

    expect(getDatasetKnowledgeDropReason({
      question: '三岁小孩打蛔虫时该吃多大剂量药',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('category_scope_conflict');

    expect(getDatasetKnowledgeDropReason({
      question: '老公有乙肝我们准备要宝宝该怎么办',
      answer: '备孕建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('category_scope_conflict');

    expect(getDatasetKnowledgeDropReason({
      question: '医生我是一名教师，目前学校很多学生发烧。我准备怀孕，请问如果打甲流疫苗后，要多久才能怀孕啊？',
      answer: '疫苗接种后备孕时间咨询',
      category: 'vaccine-reaction',
      tags: ['母婴'],
    })).toBe('category_scope_conflict');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝8个月不会主动伸手拿东西，坐不稳怎么办',
      answer: '观察发育表现，必要时就医评估。',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBeNull();
  });

  it('rejects adult diseases and unsupported service requests from dataset records', () => {
    expect(getDatasetKnowledgeDropReason({
      question: '黄疸呕吐腹泻皮肤瘙痒体重下降，初步确诊为胆囊癌如何治疗',
      answer: '症状处理建议',
      category: 'parenting-newborn',
      tags: ['母婴'],
    })).toBe('high_sensitivity_dataset_topic');

    expect(getDatasetKnowledgeDropReason({
      question: '那阴囊湿疹和毛囊炎有区别吗？',
      answer: '症状处理建议',
      category: 'common-disease',
      tags: ['母婴'],
    })).toBe('off_scope_adult_health');

    expect(getDatasetKnowledgeDropReason({
      question: '治小孩的脑积水，哪家医院最好',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('unsupported_service_request');

    expect(getDatasetKnowledgeDropReason({
      question: '广东最好白颠风的治疗医院是哪家，孩子这么小应如何治疗？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('unsupported_service_request');

    expect(getDatasetKnowledgeDropReason({
      question: '我爱人腰椎间盘突出三年，最近由于帮儿子带孩子腰腿痛得厉害，请问如何治疗？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('off_scope_adult_health');

    expect(getDatasetKnowledgeDropReason({
      question: '生孩子哺乳后乳房干瘪下垂怎么回事，有办法补救吗？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('off_scope_adult_health');
  });

  it('rejects paternity and relationship attribution records from dataset coverage', () => {
    expect(getDatasetKnowledgeDropReason({
      question: 'B超结果比实际孕周小9天，请问孩子到底是谁的？',
      answer: '症状处理建议',
      category: 'common-safety',
      tags: ['母婴'],
    })).toBe('unsupported_service_request');

    expect(getDatasetKnowledgeDropReason({
      question: '醉酒与不认识的人发生关系，现在怀孕了宝宝会是谁的啊急救',
      answer: '症状处理建议',
      category: 'common-safety',
      tags: ['母婴'],
    })).toBe('unsupported_service_request');
  });

  it('rejects treatment-seeking and severe diagnosed case records from dataset coverage', () => {
    expect(getDatasetKnowledgeDropReason({
      question: '孩子额头受伤很深，拆线后瘢痕凸起，用康瑞保和美皮护有用吗？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '我家小孩子最近总是呼吸困难，去医院检查说是支气管哮喘，医生建议及时配合治疗和注意饮食习惯。',
      answer: '症状处理建议',
      category: 'parenting-3-6',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '孩子检查说是脑桥小脑角综合征，这个病容易与哪些症状混淆？',
      answer: '症状处理建议',
      category: 'common-symptoms',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝接种百白破后眼睛周围起小红疙瘩怎么办？',
      answer: '观察皮疹、精神状态和呼吸情况，必要时就医。',
      category: 'vaccine-reaction',
      tags: ['母婴'],
    })).toBeNull();
  });

  it('rejects low-information forms, adult reproductive cases, and biometric calculation records', () => {
    expect(getDatasetKnowledgeDropReason({
      question: '全部症状：发病时间及原因：治疗情况：一直不知道对孩子不会所以就没当回事。',
      answer: '症状处理建议',
      category: 'common-symptoms',
      tags: ['母婴'],
    })).toBe('low_information_case_template');

    expect(getDatasetKnowledgeDropReason({
      question: '我生完小孩后，给小孩断奶后，发现自己的乳房一变大一变小，穿衣服都很明显怎么办？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('adult_reproductive_case');

    expect(getDatasetKnowledgeDropReason({
      question: '每次月经十多天才干净，生完孩子后做过利普刀，现在还是这样是什么原因？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('adult_reproductive_case');

    expect(getDatasetKnowledgeDropReason({
      question: '男性发烧打针期间有性生活怀孕对胎儿有什么影响',
      answer: '症状处理建议',
      category: 'vaccine-reaction',
      tags: ['母婴'],
    })).toBe('adult_reproductive_case');

    expect(getDatasetKnowledgeDropReason({
      question: '帮忙算下胎儿多重双顶径9.0cm，股骨长7.1cm，腹围98，这个可以算出宝宝多重吗',
      answer: '症状处理建议',
      category: 'pregnancy-early',
      tags: ['母婴'],
    })).toBe('biometric_measurement_case');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝头围30.7cm，腹围29.9cm，肱骨长5.5cm，股骨长6.6cm可以算出宝宝有多重吗？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('biometric_measurement_case');

    expect(getDatasetKnowledgeDropReason({
      question: '孕妇用补充DHA吗，有人说吃孕妇DHA胶囊对宝宝大脑视力发育好是真的吗？',
      answer: '孕期营养补充建议',
      category: 'common-development',
      tags: ['母婴'],
    })).toBeNull();
  });

  it('rejects noisy pregnancy-prep service routing and high-sensitivity decision records', () => {
    expect(getDatasetKnowledgeDropReason({
      question: '四维彩超是什么怀孕20周能检查四维彩超吗具体检查什么呢？四维彩超是什么怀孕20周能检查四维彩超吗具体检查什么呢？四维彩超是什么怀孕20周能检查四维彩超吗具体检查什么呢？（）',
      answer: '症状处理建议',
      category: 'pregnancy-prep',
      tags: ['母婴'],
    })).toBe('low_information_case_template');

    expect(getDatasetKnowledgeDropReason({
      question: '高考体检会检查有无怀孕吗抽血的时候如果怀孕了抽血会检查出来填在报告上吗',
      answer: '症状处理建议',
      category: 'pregnancy-prep',
      tags: ['母婴'],
    })).toBe('unsupported_service_request');

    expect(getDatasetKnowledgeDropReason({
      question: '医生，我今年28岁，准备怀孕，但是查出来是贫血，现在想治疗贫血，但是去医院没有血液科，我应该挂哪个科',
      answer: '症状处理建议',
      category: 'pregnancy-prep',
      tags: ['母婴'],
    })).toBe('unsupported_service_request');

    expect(getDatasetKnowledgeDropReason({
      question: '我怀孕18周，O型血，老公A型血，溶血指数1：512。如何孕前干预？哪家医院可以孕前干预？',
      answer: '症状处理建议',
      category: 'pregnancy-prep',
      tags: ['母婴'],
    })).toBe('unsupported_service_request');

    expect(getDatasetKnowledgeDropReason({
      question: '不知道怀孕了，去做了一次体检的胸透，那时怀孕十天左右我想知道这孩子能不能要啊',
      answer: '症状处理建议',
      category: 'pregnancy-prep',
      tags: ['母婴'],
    })).toBe('high_sensitivity_dataset_topic');

    expect(getDatasetKnowledgeDropReason({
      question: '孕前需要做哪些检查项目？',
      answer: '孕前检查项目科普',
      category: 'pregnancy-prep',
      tags: ['母婴'],
    })).toBeNull();
  });

  it('rejects emergency ingestion and complex diagnosed follow-up records without blocking common care questions', () => {
    expect(getDatasetKnowledgeDropReason({
      question: '我家孩子把水银吃了，一岁了，怎么办啊，都有哪些明显症状？',
      answer: '症状处理建议',
      category: 'common-symptoms',
      tags: ['母婴'],
    })).toBe('emergency_or_poisoning_case');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝8个月不会主动伸手拿东西，坐不稳，不会扶站。检查运动神经发育迟缓，核磁共振结果是第三脑室稍饱满。应该怎样治疗，要治疗多久康复？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝8个月不会主动伸手拿东西，坐不稳怎么办',
      answer: '观察发育表现，必要时就医评估。',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBeNull();

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝发烧怎么办',
      answer: '发热时观察体温、精神状态和进食情况。',
      category: 'common-symptoms',
      tags: ['母婴'],
    })).toBeNull();
  });

  it('rejects obvious off-scope search queries before random authority boosting', () => {
    expect(isOutOfScopeKnowledgeQuery('中文调研')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('青春期发育')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('阳痿早泄')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('育儿补贴怎么领取')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('孕产妇死亡率')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('死产和死胎')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('胎停怎么办')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('哪家医院最好')).toBe(true);
    expect(isOutOfScopeKnowledgeQuery('宝宝发烧怎么办')).toBe(false);
  });

  it('does not return unrelated authority records for off-topic or unmatched searches', () => {
    expect(searchQA('中文调研', { limit: 5 })).toEqual([]);
    expect(searchQA('阳痿早泄', { limit: 5 })).toEqual([]);
    expect(searchQA('育儿补贴', { limit: 5 })).toEqual([]);
    expect(searchQA('孕产妇死亡率', { limit: 5 })).toEqual([]);
    expect(searchQA('死产 死胎', { limit: 5 })).toEqual([]);
    expect(searchQA('完全无关的随机词条', { limit: 5 })).toEqual([]);
  });

  it('rejects death-related authority cache records even when terms appear outside the title', () => {
    expect(containsDeathRelatedTerms('降低孕产妇死亡率行动计划')).toBe(true);
    expect(getAuthorityKnowledgeDropReason({
      question: '孕产妇健康行动计划',
      summary: '目标包括降低孕产妇死亡率。',
      answer: '政策解读正文',
      source_org: '中国政府网',
    })).toBe('death_related_term');

    expect(getAuthorityKnowledgeDropReason({
      question: '孕早期出血观察',
      summary: '介绍胎停相关处理。',
      answer: '正文',
      source_org: '权威机构',
    })).toBe('death_related_term');
  });

  it('rejects disabled or social-style third-party Chinese medical cache records', () => {
    expect(getAuthorityKnowledgeDropReason({
      question: '产后盆底肌恢复训练',
      summary: '产后盆底肌恢复需要结合伤口、恶露和盆底功能情况。',
      answer: '产后盆底肌训练应在身体恢复允许时逐步开始，先进行盆底功能评估，再根据漏尿、下坠感、疼痛和腹直肌恢复情况安排训练强度。训练过程中如果出现不适，应暂停并咨询妇产科或盆底康复医生。'.repeat(8),
      source_id: 'yilianmeiti-maternal-child',
      source_org: '医联媒体',
      source_class: 'medical_platform',
      source_url: 'https://www.yilianmeiti.com/article/123.html',
      updated_at: '2026-04-01T00:00:00.000Z',
    })).toBe('medical_platform_disabled_source');

    expect(getAuthorityKnowledgeDropReason({
      question: '吃母乳就是母乳喂养？',
      summary: '母乳喂养指导。',
      answer: '同部门的小李最近升级做了新手妈妈，每天微信朋友圈是各种晒娃，初为人母的幸福可谓溢于言表。一天微信聊天时，她吐槽喂养过程很累。'.repeat(20),
      source_id: 'kepuchina-maternal-child',
      source_org: '科普中国',
      source_class: 'medical_platform',
      source_url: 'https://www.kepuchina.cn/article/articleinfo?ar_id=66617',
      updated_at: '2023-06-01',
    })).toBe('medical_platform_casual_or_promotional');
  });

  it('keeps high-quality enabled third-party Chinese medical cache records', () => {
    expect(getAuthorityKnowledgeDropReason({
      question: '孕期体重管理和营养建议',
      summary: '孕期体重管理应结合孕前体重、孕周和胎儿发育情况。',
      answer: '孕期体重管理应结合孕前体重、孕周和胎儿发育情况，饮食上保持主食、优质蛋白、蔬菜水果和奶类摄入，避免长期高糖高油饮食。若体重增长过快或过慢，应咨询产科医生并结合产检结果调整。'.repeat(8),
      source_id: 'youlai-pregnancy-guide',
      source_org: '有来医生',
      source_class: 'medical_platform',
      source_url: 'https://m.youlai.cn/special/advisor/dOP09kv7LD.html',
      updated_at: '2025-03-01T00:00:00.000Z',
    })).toBeNull();
  });
});

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
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '哺乳期用药安全需要注意什么？',
      answer: '哺乳期用药安全科普',
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
      question: '孕妇吃橙子会有黄疸吗？我每天都吃一个橙子？',
      answer: '症状处理建议',
      category: 'parenting-newborn',
      tags: ['母婴'],
    })).toBe('category_scope_conflict');

    expect(getDatasetKnowledgeDropReason({
      question: '我去吸氧回来后宝宝动得我肚子不舒服',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('category_scope_conflict');

    expect(getDatasetKnowledgeDropReason({
      question: '我现在都6个多月了前34个月都没好好吃饭现在爱吃辣椒小孩不大才1斤多沉小孩怎么才长啊',
      answer: '症状处理建议',
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

  it('rejects hospital pricing and appointment service requests without blocking general prenatal scan education', () => {
    expect(getDatasetKnowledgeDropReason({
      question: '怀孕23周想去妇检做四维彩超需要预约吗？做四维彩超需要多少钱',
      answer: '症状处理建议',
      category: 'pregnancy-early',
      tags: ['母婴'],
    })).toBe('unsupported_service_request');

    expect(getDatasetKnowledgeDropReason({
      question: '你们医院能做四维彩超吗，孕妇做四维彩超需要多少钱',
      answer: '症状处理建议',
      category: 'pregnancy-early',
      tags: ['母婴'],
    })).toBe('unsupported_service_request');

    expect(getDatasetKnowledgeDropReason({
      question: '淮安妇幼保健院微量元素检查周日做吗，什么时候出结果，要挂号什么科？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('unsupported_service_request');

    expect(getDatasetKnowledgeDropReason({
      question: '个月我们家宝宝6个月了，医生说打B型流感疫苗148元，是自愿的，不知道这个疫苗有必须打吗',
      answer: '症状处理建议',
      category: 'vaccine-second',
      tags: ['母婴'],
    })).toBe('unsupported_service_request');

    expect(getDatasetKnowledgeDropReason({
      question: '在防疫站注射预防肺结核的疫苗花钱吗？',
      answer: '症状处理建议',
      category: 'vaccine-schedule',
      tags: ['母婴'],
    })).toBe('unsupported_service_request');

    expect(getDatasetKnowledgeDropReason({
      question: '怀孕23周不做四维彩超可以吗？',
      answer: '孕期检查科普',
      category: 'pregnancy-mid',
      tags: ['母婴'],
    })).toBeNull();
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
      question: '以前正常送幼儿园之后出现症状不爱说话不爱玩不能和小朋友做游戏对玩具不感兴趣智力达不到同龄儿童总像迷迷糊糊的有一些刻板性动作睡眠不好什么都害怕做的磁共振和脑电出的结果是左脑发育不太好精神发育迟缓需要在做什么更详细的检查吗他能治疗吗',
      answer: '症状处理建议',
      category: 'parenting-1-3',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝得了霰粒肿1岁3个月得了霰粒肿，眼科医生说3岁以后再去，什么药也没开，心里很担心想问下真的要等到3岁吗？谢谢',
      answer: '症状处理建议',
      category: 'parenting-1-3',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '孩子晕厥了几次，症状和睡着了一样，不知道什么原因，CT、24小时脑电图，核磁共振，心脏彩超等都检查了，没查出什么病。',
      answer: '症状处理建议',
      category: 'common-symptoms',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '我的孩子四岁了，1岁半得了白癫风，治了2年大面积已经好了，但是现在身体出现了有大米粒大的，是不是这个病在复发？我该怎么办？',
      answer: '症状处理建议',
      category: 'parenting-1-3',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝接种百白破后眼睛周围起小红疙瘩怎么办？',
      answer: '观察皮疹、精神状态和呼吸情况，必要时就医。',
      category: 'vaccine-reaction',
      tags: ['母婴'],
    })).toBeNull();
  });

  it('rejects complex neonatal diagnosed follow-up while keeping general jaundice education', () => {
    expect(getDatasetKnowledgeDropReason({
      question: '孩子出生查出室间隔于大动脉短轴切面相当于9-10钟处连续中断，大小约3mm彩色DOPPLE检查见一束五彩血流由左室进右室。诊断为先心病：室间隔缺损，新生儿卵圆孔未闭',
      answer: '症状处理建议',
      category: 'parenting-newborn',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '小孩会得核黄疸吗？孩子出生第四天黄疸309，嗜睡，拒奶，吸允力变差，小孩得核黄疸的几率大吗？',
      answer: '症状处理建议',
      category: 'parenting-newborn',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '孩子刚出生一天就被医生诊断重度肺炎，第四天又被诊断轻度脑病，现在每三小时能吃三十毫升奶。',
      answer: '症状处理建议',
      category: 'parenting-newborn',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝黄疸高怎么办？',
      answer: '观察黄疸变化、吃奶和精神状态，按医生建议复查胆红素。',
      category: 'parenting-newborn',
      tags: ['母婴'],
    })).toBeNull();
  });

  it('rejects medication-selection requests without blocking general skin-care education', () => {
    expect(getDatasetKnowledgeDropReason({
      question: '宝宝屁股长尿布湿疹了抹什么药',
      answer: '症状处理建议',
      category: 'common-disease',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '湿疹吃什么药，最好是西药。以前在一家中医看过，但医生给我开的中成药，也没有药名。',
      answer: '症状处理建议',
      category: 'common-disease',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '请专家帮我配药，已经折磨我两年的皮肤病一到冬季皮肤瘙痒，一挠就会出现红色小疙瘩，很多医生说是湿疹。',
      answer: '症状处理建议',
      category: 'common-disease',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝用金蛇脂行么？去湿疹的。',
      answer: '症状处理建议',
      category: 'common-disease',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '维生素b12和什么药配合才能治湿疹',
      answer: '症状处理建议',
      category: 'common-disease',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝注射了流感疫苗后咳嗽可以吃药吗',
      answer: '症状处理建议',
      category: 'vaccine-second',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '我家宝宝刚打完疫苗有点腹泻能吃药吗',
      answer: '症状处理建议',
      category: 'vaccine-reaction',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝是母乳性黄疸，吃了一段时间茵栀黄，退了，停药后又黄了，茵栀黄吃多了是不是对宝宝不好？',
      answer: '症状处理建议',
      category: 'parenting-newborn',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '医生说宝宝患的是肠炎，还有轻度脱水，现在宝宝没有拉了，可以给宝宝吃妈咪爱吗，还要吃腹泻奶粉吗',
      answer: '症状处理建议',
      category: 'nutrition-baby',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '医生，一般宝宝得了黄胆值是140多，如果打几天护脑针的话，黄胆值会降下来吗？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '我怀孕五个多月了可以吃贝特晓芙牌叶酸铁钙片吗？我听别人说叶酸和铁补多了也不好。',
      answer: '症状处理建议',
      category: 'pregnancy-prep',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '未做孕前检查，意外怀孕30天，之前睡眠质量不好，嗓子发炎喝过双黄消炎片，怎莫办',
      answer: '症状处理建议',
      category: 'pregnancy-prep',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '怀孕2个多月，发现怀孕前吃的复方葡萄糖酸钙口服溶液，请问是否还可以继续口服？',
      answer: '症状处理建议',
      category: 'pregnancy-prep',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '小孩贫血，想买铁之缘片来补，医生们觉得这个补血怎么样？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝有蚕豆病妈妈可以用鹿角外敷吗',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '哺乳期牙疼吃了止疼片和阿莫西林，今天孩子吃了我的奶，对他有什么影响',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '产妇做了ct孩子吃奶了影响到底有多大',
      answer: '症状处理建议',
      category: 'nutrition-baby',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '30岁脚部骨折拍了ct打石膏多久能要小孩？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '哺乳期眼部打麻药，用了1/5ml的麻药对9个月宝宝会有影响吗？多长时间可以哺母乳',
      answer: '症状处理建议',
      category: 'nutrition-baby',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '怀孕3个多月得腮腺炎输液对宝宝有影响吗怀孕3个多月的时候得了腮腺炎输液了，会对宝宝有影响吗，5个多月坐了四维说没事发育挺好的。',
      answer: '症状处理建议',
      category: 'common-development',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '一天喝了三斤米酒对宝宝吃奶有影响吗',
      answer: '症状处理建议',
      category: 'nutrition-baby',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '我在医院做了红外线，诊断是乳腺增生，并且医生说外侧硬块比较多，内测还差不多，也是刚怀孕，医生说吃药的话影响胎儿发育，贴膏药不会影响孩子的发育，可有的医生说都影响，我该怎么办？谢谢。',
      answer: '症状处理建议',
      category: 'common-development',
      tags: ['母婴'],
    })).toBe('personal_treatment_request');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝湿疹怎么护理？',
      answer: '保持皮肤清洁保湿，避免刺激，严重或反复时就医评估。',
      category: 'common-disease',
      tags: ['母婴'],
    })).toBeNull();

    expect(getDatasetKnowledgeDropReason({
      question: '孕期用药安全需要注意什么？',
      answer: '孕期用药科普，建议咨询医生或药师。',
      category: 'pregnancy-early',
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
      question: '我生宝宝已2个来月，会阴撕裂的伤口未感染，未红肿，表面看上去恢复得不错。但走路和抬腿或双腿张开较大辐度时感觉疼痛。42天的时候到医院复查时，医生说再观察看看。现在都2个多月了，痛感还在。请问是什么原因。是不是里面缝线的地方没长好，还是长什么东西了？',
      answer: '症状处理建议',
      category: 'parenting-1-3',
      tags: ['母婴'],
    })).toBe('adult_reproductive_case');

    expect(getDatasetKnowledgeDropReason({
      question: '请问我生完孩子七个月了。可是下面总是断断续续有血，偶尔小腹有点疼，孩子俩个月去医院检查说是宫颈有点充血，吃的消炎药一直到三个月时候才好，这个月还没来下面又有血了，不知道是不是月经，怎么回事呢？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('adult_reproductive_case');

    expect(getDatasetKnowledgeDropReason({
      question: '我怀孕前有阴道炎，现在我怀孕8个月了，对宝宝有影响吗。',
      answer: '症状处理建议',
      category: 'pregnancy-prep',
      tags: ['母婴'],
    })).toBe('adult_reproductive_case');

    expect(getDatasetKnowledgeDropReason({
      question: '生完孩子，月子病，关节疼痛',
      answer: '症状处理建议',
      category: 'parenting-newborn',
      tags: ['母婴'],
    })).toBe('adult_reproductive_case');

    expect(getDatasetKnowledgeDropReason({
      question: '流产后因为腰酸让老公按了几下腰，过了一个月后腰突然放射性痛，臀部神经肌肉都痛，还麻痹，妇科检查又没有问题，是风湿还是坐骨神经痛，很担心',
      answer: '症状处理建议',
      category: 'pregnancy-birth',
      tags: ['母婴'],
    })).toBe('adult_reproductive_case');

    expect(getDatasetKnowledgeDropReason({
      question: '我结婚前118斤，怀孕到临产时200斤，现在孩子两岁了，我还有170斤，咋办？',
      answer: '症状处理建议',
      category: 'pregnancy-late',
      tags: ['母婴'],
    })).toBe('adult_reproductive_case');

    expect(getDatasetKnowledgeDropReason({
      question: '每次月经十多天才干净，生完孩子后做过利普刀，现在还是这样是什么原因？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('adult_reproductive_case');

    expect(getDatasetKnowledgeDropReason({
      question: '在涂料厂上班，得了湿疹，手指很痒，起了很多水疱，反复发作，有半个月了',
      answer: '症状处理建议',
      category: 'common-disease',
      tags: ['母婴'],
    })).toBe('off_scope_adult_health');

    expect(getDatasetKnowledgeDropReason({
      question: '男性发烧打针期间有性生活怀孕对胎儿有什么影响',
      answer: '症状处理建议',
      category: 'vaccine-reaction',
      tags: ['母婴'],
    })).toBe('adult_reproductive_case');

    expect(getDatasetKnowledgeDropReason({
      question: '全部症状：宫缩频繁但是肚子不痛，平均5分钟宫缩一次。发病时间及原因：2011-10-28 19时30分左右治疗情况',
      answer: '症状处理建议',
      category: 'pregnancy-mid',
      tags: ['母婴'],
    })).toBe('low_information_case_template');

    expect(getDatasetKnowledgeDropReason({
      question: '患者信息：男1岁河北沧州医生建议宝宝半个小时后再喂奶，刚半个小时就喂奶了，是否影响药效曾经治疗情况及是否有过敏、遗传病史：没',
      answer: '症状处理建议',
      category: 'parenting-1-3',
      tags: ['母婴'],
    })).toBe('low_information_case_template');

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
      question: '怀孕39周胎儿双顶径100mm股骨长78mm好生吗，一切都很正常请问可以顺产吗',
      answer: '症状处理建议',
      category: 'pregnancy-birth',
      tags: ['母婴'],
    })).toBe('biometric_measurement_case');

    expect(getDatasetKnowledgeDropReason({
      question: '怀孕刚四个月，去查宝宝双顶径是4.4，股骨是6.67，孩子发育正常不？',
      answer: '症状处理建议',
      category: 'common-development',
      tags: ['母婴'],
    })).toBe('biometric_measurement_case');

    expect(getDatasetKnowledgeDropReason({
      question: '38+2周B超显示羊水量右上象限0CM，双顶颈约9.4CM，股骨长约7.2CM，S/D值3.8，请专家给予最详细专业解释及办法',
      answer: '症状处理建议',
      category: 'pregnancy-early',
      tags: ['母婴'],
    })).toBe('biometric_measurement_case');

    expect(getDatasetKnowledgeDropReason({
      question: '追问一下，宝宝四个半月能吃吗？煮水煮多久，一次喝多少？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('low_information_case_template');

    expect(getDatasetKnowledgeDropReason({
      question: '孕妇用补充DHA吗，有人说吃孕妇DHA胶囊对宝宝大脑视力发育好是真的吗？',
      answer: '孕期营养补充建议',
      category: 'common-development',
      tags: ['母婴'],
    })).toBeNull();

    expect(getDatasetKnowledgeDropReason({
      question: '产后恶露一般如何观察，什么时候需要就医？',
      answer: '产后恢复科普',
      category: 'pregnancy-birth',
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
      question: '查出婴儿侧脑室前角宽，肾盂分离，医生说不算严重，我现在还有必要继续留下肚子里的这个孩子吗？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('high_sensitivity_dataset_topic');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝出生后需要进一步检查以排除先天性风疹综合症吗？需要做哪些检查？什么时候查合适？',
      answer: '症状处理建议',
      category: 'parenting-newborn',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '羊水过多一定要抽脐带血吗？医生建议做抽脐带血，32周了还用抽吗，对胎儿有什么影响吗？',
      answer: '症状处理建议',
      category: 'parenting-newborn',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '我家小宝六个月检查说心脏心内膜垫缺损，需要手术治疗吗，什么时候是最佳手术时间？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '过预产期了还没分娩头胎，过预产期1天了，前半个月去检查胎儿没入盆，是否能顺产，还要不要去检查一次',
      answer: '症状处理建议',
      category: 'pregnancy-birth',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '胎儿已足月脐带绕脖子两圈能顺产吗',
      answer: '症状处理建议',
      category: 'pregnancy-birth',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '带状疱疹分娩方式选择足月孕妇患带状疱疹，要生了选择生还是刨腹',
      answer: '症状处理建议',
      category: 'pregnancy-birth',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '怀孕7个半月，最近检查说胎儿发育挺好，就是羊水为7。7，偏多应该怎么办？怎么控制它不在多的发展',
      answer: '症状处理建议',
      category: 'common-development',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '检查出肚子里面的宝宝心脏有问题',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '刚刚你回复的室间隔缺损先心病人，可以怀孕吗？目前已经意外怀孕一个多月了，可以在生产之前手术吗？',
      answer: '症状处理建议',
      category: 'pregnancy-birth',
      tags: ['母婴'],
    })).toBe('diagnosed_case_followup');

    expect(getDatasetKnowledgeDropReason({
      question: '哺乳期意外怀孕经药物流产后奶水变的少了怎么补的回来',
      answer: '症状处理建议',
      category: 'pregnancy-birth',
      tags: ['母婴'],
    })).toBe('high_sensitivity_dataset_topic');

    expect(getDatasetKnowledgeDropReason({
      question: '孕前需要做哪些检查项目？',
      answer: '孕前检查项目科普',
      category: 'pregnancy-prep',
      tags: ['母婴'],
    })).toBeNull();
  });

  it('rejects adult vaccine, environmental testing, and reproductive decision records', () => {
    expect(getDatasetKnowledgeDropReason({
      question: '（成年人）接种流感疫苗一周后，出现感冒症状，流涕，鼻塞，流眼泪，请问这是属于该疫苗的反应吗？',
      answer: '症状处理建议',
      category: 'vaccine-second',
      tags: ['母婴'],
    })).toBe('category_scope_conflict');

    expect(getDatasetKnowledgeDropReason({
      question: '我2014年10月全程注射过狂犬疫苗，今天被狗咬去了打了2针加强针，这2针加强针的保护期是多长时间？',
      answer: '症状处理建议',
      category: 'vaccine-schedule',
      tags: ['母婴'],
    })).toBe('category_scope_conflict');

    expect(getDatasetKnowledgeDropReason({
      question: '新生儿在有甲醛的房子里住三个月后如何补救，怎么样检测宝宝体内甲醛含量有多少？',
      answer: '症状处理建议',
      category: 'parenting-newborn',
      tags: ['母婴'],
    })).toBe('unsupported_service_request');

    expect(getDatasetKnowledgeDropReason({
      question: '舅舅、哥哥姐姐弟弟都是聋哑，我可以生孩子吗',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('high_sensitivity_dataset_topic');

    expect(getDatasetKnowledgeDropReason({
      question: '乙肝大三阳女怀孕前该做什么检查，如何防止孩子感染？',
      answer: '孕前检查和母婴阻断科普',
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
      question: '医生宝宝接种b型流感嗜血杆菌疫苗后出现发烧嗜睡没精神，第二天还有点小烧',
      answer: '症状处理建议',
      category: 'vaccine-reaction',
      tags: ['母婴'],
    })).toBe('emergency_or_poisoning_case');

    expect(getDatasetKnowledgeDropReason({
      question: '我女儿注射麻风腮疫苗3天注射后一直发热39度怎么治',
      answer: '症状处理建议',
      category: 'vaccine-schedule',
      tags: ['母婴'],
    })).toBe('emergency_or_poisoning_case');

    expect(getDatasetKnowledgeDropReason({
      question: '怀孕3个月食物中毒昨天下午吃了点野生菌，大概60分钟就呕吐。晚上开始腹痛腹泻，今早去医院做产检，胎儿有心跳跟胎动需要进一步治疗吗',
      answer: '症状处理建议',
      category: 'pregnancy-mid',
      tags: ['母婴'],
    })).toBe('emergency_or_poisoning_case');

    expect(getDatasetKnowledgeDropReason({
      question: '一个像小孩子弹一样的木头颗粒进嘴里了应该怎么办？',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('emergency_or_poisoning_case');

    expect(getDatasetKnowledgeDropReason({
      question: '那里可以把小孩吃掉的戒指取出来啊',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('emergency_or_poisoning_case');

    expect(getDatasetKnowledgeDropReason({
      question: '5个月宝宝今天早上8点多打完脊灰百白破，三个小时后流了6，7滴鼻血怎么回事？谢谢你陈大夫。孩子小，很害怕啊。',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('emergency_or_poisoning_case');

    expect(getDatasetKnowledgeDropReason({
      question: '怀孕5个多月强烈撞击肚子，两天感觉不到胎动了，宝宝会不会出问题了啊',
      answer: '症状处理建议',
      category: 'pregnancy-mid',
      tags: ['母婴'],
    })).toBe('emergency_or_poisoning_case');

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝被猫抓伤没打针怕吗我女儿5岁时在乡下被家养的猫抓伤，一没有打针也没吃药怕吗',
      answer: '症状处理建议',
      category: 'parenting-3-6',
      tags: ['母婴'],
    })).toBe('emergency_or_poisoning_case');

    expect(getDatasetKnowledgeDropReason({
      question: '现在孩子疼起来，特别厉害，使劲哭啊，怎么办',
      answer: '症状处理建议',
      category: 'parenting-0-1',
      tags: ['母婴'],
    })).toBe('emergency_or_poisoning_case');

    expect(getDatasetKnowledgeDropReason({
      question: '五个半月的宝宝打完白百破预防针，晚上眼睛周围起了好多小红疙瘩，请问应该怎么办？急急急',
      answer: '症状处理建议',
      category: 'parenting-0-1',
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

    expect(getDatasetKnowledgeDropReason({
      question: '宝宝接种后针眼周围有点红肿怎么办？',
      answer: '观察局部红肿范围、体温和精神状态。',
      category: 'vaccine-reaction',
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

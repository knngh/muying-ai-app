import { inferAuthorityStages } from '../src/utils/authority-stage';
import { shouldFilterAuthoritySourceUrl } from '../src/utils/authority-source-url';
import {
  getAuthoritySourceConfig,
  getTierFetchBudget,
  getTierQualityThreshold,
} from '../src/config/authority-sources';
import { getOfficialChineseAuthorityQualityDropReason } from '../src/utils/official-chinese-authority-quality';
import {
  containsDeathRelatedTerms,
  detectAudience,
  detectTopic,
  evaluateAuthorityDocumentQuality,
  isHighRiskOrClickbaitTitle,
  isLikelyEnglishNavigationShell,
  isOffTopicGovPolicyTitle,
  shouldPublishDocument,
} from '../src/services/authority-adapters/base.adapter';
import { getAuthorityKnowledgeDropReason } from '../src/utils/knowledge-content-guard';

describe('authority content guards', () => {
  it('keeps postpartum recovery articles out of pregnancy stages', () => {
    const source = getAuthoritySourceConfig('cma-kepu-maternal-child')!;
    const input = {
      sourceUrl: 'https://www.cma.org.cn/art/2025/10/30/art_4584_60359.html',
      title: '产后尿失禁一般和这五个因素有关！怎么检查和治疗？',
      summary: '生产后很多妈妈会出现憋不住尿的情况，也就是产后尿失禁。',
      contentText: '产后盆底肌肉恢复需要循序渐进，必要时接受盆底康复评估和治疗。',
    };
    const topic = detectTopic(input, source);
    const audience = detectAudience(input, source);

    expect(topic).toBe('postpartum');
    expect(audience).toBe('产后妈妈');
    expect(inferAuthorityStages({ ...input, topic, audience })).toEqual(['postpartum']);
  });

  it('locks postpartum mom guidance to postpartum even when body text has noisy stage signals', () => {
    const source = getAuthoritySourceConfig('cma-kepu-maternal-child')!;
    const input = {
      sourceUrl: 'https://www.cma.org.cn/art/2024/11/18/art_4584_59526.html',
      title: '产后漏尿？试试凯格尔运动',
      summary: '很多产后女性或中老年女性会有压力性尿失禁。',
      contentText: '文章介绍盆底肌训练、凯格尔运动、咳嗽大笑时漏尿的处理。正文可能提到足月、孩子、女性等泛化词，但目标对象仍是产后妈妈。',
    };
    const topic = detectTopic(input, source);
    const audience = detectAudience(input, source);

    expect(topic).toBe('postpartum');
    expect(audience).toBe('产后妈妈');
    expect(inferAuthorityStages({ ...input, topic, audience })).toEqual(['postpartum']);
  });

  it('does not place postpartum breastfeeding guidance in pregnancy stages', () => {
    const source = getAuthoritySourceConfig('aap')!;
    const input = {
      sourceUrl: 'https://www.healthychildren.org/English/ages-stages/baby/breastfeeding/Pages/postpartum-depression-breastfeeding.aspx',
      title: 'Postpartum Depression & Breastfeeding',
      summary: 'How a mom seeking help for postpartum depression can still meet breastfeeding goals.',
      contentText: 'This article is about postpartum depression treatment support and breastfeeding after birth.',
    };
    const topic = detectTopic(input, source);
    const audience = detectAudience(input, source);
    const stages = inferAuthorityStages({ ...input, topic, audience });

    expect(stages).toEqual(expect.arrayContaining(['postpartum', '0-6-months', '6-12-months']));
    expect(stages).not.toContain('first-trimester');
    expect(stages).not.toContain('second-trimester');
    expect(stages).not.toContain('third-trimester');
  });

  it('keeps combined pregnancy and postpartum clinical guidance in both timelines', () => {
    const source = getAuthoritySourceConfig('acog')!;
    const input = {
      sourceUrl: 'https://www.acog.org/clinical/clinical-guidance/clinical-practice-guideline/articles/2022/05/headaches-in-pregnancy-and-postpartum',
      title: 'Headaches in Pregnancy and Postpartum',
      summary: 'Guidance for evaluating and treating headaches during pregnancy and postpartum.',
      contentText: 'Recommendations apply to patients during pregnancy and the postpartum period.',
    };
    const topic = detectTopic(input, source);
    const audience = detectAudience(input, source);
    const stages = inferAuthorityStages({ ...input, topic, audience });

    expect(topic).toBe('pregnancy');
    expect(stages).toEqual(expect.arrayContaining(['first-trimester', 'second-trimester', 'third-trimester', 'postpartum']));
  });

  it('keeps explicit pregnancy week guides on the pregnancy timeline only', () => {
    expect(
      inferAuthorityStages({
        title: '孕期全指导：怀孕第40周',
        summary: '本周继续关注分娩准备与产检安排。',
        contentText: '本周内容会提到分娩和新生儿适应，但仍属于孕晚期周度指导。',
        audience: '孕妇',
        topic: 'policy',
      }),
    ).toEqual(['third-trimester']);
  });

  it('does not classify baby articles as postpartum only because summary mentions after birth', () => {
    const source = getAuthoritySourceConfig('aap')!;
    const input = {
      sourceUrl: 'https://www.healthychildren.org/English/ages-stages/baby/Pages/Your-Babys-Head.aspx',
      title: "Your Baby's Head",
      summary: 'In the first weeks after birth, your baby may still have molding of the skull.',
      contentText: 'This article explains normal newborn head shape changes.',
      audience: '婴幼儿家长',
      topic: 'development',
    };
    expect(detectTopic(input, source)).not.toBe('postpartum');
    expect(detectTopic(input, source)).not.toBe('pregnancy');

    const stages = inferAuthorityStages({
      title: input.title,
      summary: input.summary,
      contentText: input.contentText,
      audience: input.audience,
      topic: input.topic,
    });

    expect(stages).not.toContain('postpartum');
    expect(stages).not.toContain('1-3-years');
  });

  it('filters site index and generic CDC landing pages', () => {
    expect(
      shouldFilterAuthoritySourceUrl({
        source_org: 'CDC',
        question: 'Índice del sitio | Child Development | CDC',
        source_url: 'https://www.cdc.gov/child-development/es/site.html',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_org: 'CDC',
        question: 'Child Development | CDC',
        source_url: 'https://www.cdc.gov/child-development/index.html',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_org: 'CDC',
        question: 'Information About Infants & Toddlers (Ages 0-3) | Parent Information | CDC',
        source_url: 'https://www.cdc.gov/parents/infants/index.html',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_org: 'CDC',
        question: 'Información para los padres de niños | CDC',
        source_url: 'https://www.cdc.gov/parents/spanish/children/index.html',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_org: 'CDC',
        question: 'Hearing Loss in Children | Hearing Loss in Children | CDC',
        source_url: 'https://www.cdc.gov/ncbddd/hearingloss/index.html',
      }),
    ).toBe(true);
  });

  it('rejects Chinese navigation shells at the shared document quality gate', () => {
    const contentText = '首页 新闻中心 技术规范 工作指南 监测结果 通讯专栏 继续教育 基层交流 共享资源 关于我们 搜索 版权所有 备案';
    const document = {
      sourceId: 'ncwch-maternal-child-health',
      sourceOrg: '国家卫生健康委妇幼健康中心',
      sourceUrl: 'https://www.ncwchnhc.org.cn/content/content.html?id=7310650918054137856',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '政策文件',
      updatedAt: undefined,
      audience: '婴幼儿家长',
      topic: 'policy',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '页面栏目导航。',
      contentText,
      metadataJson: {},
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(document).decision).toBe('reject');
    expect(shouldPublishDocument(document)).toBe('rejected');
  });

  it('passes real Chinese maternal-child guidance through the shared document quality gate', () => {
    const document = {
      sourceId: 'ncwch-maternal-child-health',
      sourceOrg: '国家卫生健康委妇幼健康中心',
      sourceUrl: 'https://www.ncwchnhc.org.cn/content/content.html?id=7313481602116358144',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '体重管理指导原则（2024年版）—孕前、孕期及产后女性体重管理',
      updatedAt: undefined,
      audience: '孕妇',
      topic: 'pregnancy',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '孕前、孕期及产后女性体重管理指导。',
      contentText: '孕前体重管理应通过合理膳食和适量运动，将体重调整到适宜范围。孕期体重管理需要结合孕早期、孕中期和孕晚期能量需求，定期监测体重增长。产后体重管理应支持母乳喂养，膳食多样，不过量进补，并循序渐进恢复运动。'.repeat(2),
      metadataJson: {},
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(document).decision).toBe('pass');
    expect(shouldPublishDocument(document)).toBe('published');
  });

  it('rejects AAP navigation shells that have no article body after Page Content', () => {
    const contentText = [
      'Delayed Puberty in Boys: Information for Parents - HealthyChildren.org',
      'Turn on more accessible mode Turn off more accessible mode Skip Ribbon Commands Skip to main content',
      'Our Sponsors Log in | Register Donate Menu Log in | Register Home Our Sponsors',
      'Ages & Stages Healthy Living Safety & Prevention Family Life Health Issues Tips & Tools Our Mission',
      'AAP Find a Pediatrician Ages & Stages Your Child’s Checkups',
      'Healthy Children > Ages & Stages > Gradeschool > Puberty > Delayed Puberty in Boys: Information for Parents',
      'Page Content',
    ].join(' ');
    const document = {
      sourceId: 'aap',
      sourceOrg: 'American Academy of Pediatrics',
      sourceUrl: 'https://www.healthychildren.org/English/ages-stages/gradeschool/puberty/Pages/Delayed-Puberty-in-Boys-Information-for-Parents.aspx',
      sourceLanguage: 'en' as const,
      sourceLocale: 'en-US',
      title: 'Delayed Puberty in Boys: Information for Parents',
      updatedAt: undefined,
      audience: '婴幼儿家长',
      topic: 'development',
      region: 'US',
      riskLevelDefault: 'green' as const,
      summary: 'Delayed Puberty in Boys: Information for Parents - HealthyChildren.org',
      contentText,
      metadataJson: {},
      publishStatus: 'draft' as const,
    };

    expect(isLikelyEnglishNavigationShell(contentText)).toBe(true);
    expect(evaluateAuthorityDocumentQuality(document).decision).toBe('reject');
    expect(evaluateAuthorityDocumentQuality(document).reasons).toContain('english_navigation_shell');
    expect(shouldPublishDocument(document)).toBe('rejected');
  });

  it('rejects off-topic gov.cn policy summaries that mention childcare only as one of many topics', () => {
    expect(isOffTopicGovPolicyTitle('托育、养老、文旅......这些产业迎利好！', 'govcn-jiedu-muying')).toBe('govcn_elder_care_mixed');
    expect(isOffTopicGovPolicyTitle('事关餐饮住宿、养老托育、家政服务！国新办发布会聚焦促进服务消费高质量发展', 'govcn-jiedu-muying')).toBe('govcn_elder_care_mixed');
    expect(isOffTopicGovPolicyTitle('推动资源下沉，优先发展养老、托育等——让社区服务更有温度', 'govcn-jiedu-muying')).toBe('govcn_elder_care_mixed');
    expect(isOffTopicGovPolicyTitle('国务院办公厅关于促进养老托育服务健康发展的意见', 'govcn-muying')).toBe('govcn_elder_care_mixed');
    expect(isOffTopicGovPolicyTitle('个人消费贷贴息、育儿补贴免征个税......国务院8月重要政策', 'govcn-jiedu-muying')).toBe('govcn_non_health_policy');
    expect(isOffTopicGovPolicyTitle('事关孩子上学、育儿补贴、社保……六部门最新安排', 'govcn-jiedu-muying')).toBe('govcn_non_health_policy');
    expect(isOffTopicGovPolicyTitle('《关于推进儿童医疗卫生服务高质量发展的意见》解读', 'govcn-jiedu-muying')).toBe('govcn_broad_child_policy');
    expect(isOffTopicGovPolicyTitle('国务院关于印发中国妇女发展纲要和中国儿童发展纲要的通知', 'govcn-muying')).toBe('govcn_broad_child_policy');
    expect(isOffTopicGovPolicyTitle('“十五五”规划《纲要（草案）》：全面落实生育休假制度', 'govcn-jiedu-muying')).toBe('govcn_broad_policy');
    expect(isOffTopicGovPolicyTitle('《民用机场母婴室规划建设和设施设备配置指南》解读', 'govcn-jiedu-muying')).toBe('govcn_broad_policy');
  });

  it('rejects national insurance drug catalog interpretations even when they mention 生育保险', () => {
    expect(
      isOffTopicGovPolicyTitle(
        '2024年国家基本医疗保险、工伤保险和生育保险药品目录调整通过初步形式审查的药品名单公示情况解读',
        'govcn-jiedu-muying',
      ),
    ).toBe('govcn_drug_catalog');
    expect(
      isOffTopicGovPolicyTitle(
        '《国家医保局 人力资源社会保障部关于印发<国家基本医疗保险、工伤保险和生育保险药品目录（2021年）>的通知》政策解读',
        'govcn-jiedu-muying',
      ),
    ).toBe('govcn_drug_catalog');
  });

  it('rejects vaccine export and disabled-children special-education roundups', () => {
    expect(
      isOffTopicGovPolicyTitle(
        '商务部外贸司负责人就《关于公布可供对外出口的新型冠状病毒疫苗产品清单的公告》答记者问',
        'govcn-jiedu-muying',
      ),
    ).toBe('govcn_export_policy');
    expect(
      isOffTopicGovPolicyTitle(
        '特教提升行动计划发布：2025年适龄残疾儿童义务教育入学率达到97%',
        'govcn-jiedu-muying',
      ),
    ).toBe('govcn_special_education');
  });

  it('rejects gov.cn benefit/support policies while keeping health guidance', () => {
    expect(isOffTopicGovPolicyTitle('《育儿补贴制度管理规范（试行）》解读', 'govcn-jiedu-muying')).toBe('govcn_non_health_policy');
    expect(isOffTopicGovPolicyTitle('国家医保局：你想知道的生育保险政策都在这里', 'govcn-jiedu-muying')).toBe('govcn_non_health_policy');
    expect(isOffTopicGovPolicyTitle('托育服务如何更普惠？（政策问答·回应关切）', 'govcn-jiedu-muying')).toBe('govcn_non_health_policy');
    expect(isOffTopicGovPolicyTitle('财政部税政司 税务总局所得税司有关负责人就落实3岁以下婴幼儿照护个人所得税专项附加扣除有关问题答记者问', 'govcn-jiedu-muying')).toBe('govcn_non_health_policy');
    expect(isOffTopicGovPolicyTitle('《婴幼儿营养喂养评估服务指南（试行）》文件解读', 'govcn-jiedu-muying')).toBeNull();
    expect(isOffTopicGovPolicyTitle('3岁以下婴幼儿健康养育照护指南（试行）文件解读', 'govcn-jiedu-muying')).toBeNull();
    expect(isOffTopicGovPolicyTitle('《婴幼儿配方乳粉产品配方注册管理办法》解读', 'govcn-jiedu-muying')).toBeNull();
    expect(isOffTopicGovPolicyTitle('《关于推进生育友好医院建设的意见》解读', 'govcn-jiedu-muying')).toBeNull();
  });

  it('only applies gov.cn off-topic guard to gov.cn policy sources', () => {
    expect(isOffTopicGovPolicyTitle('养老托育服务健康发展', 'cdc')).toBeNull();
    expect(isOffTopicGovPolicyTitle('国家医保药品目录调整', 'nhc-fys')).toBeNull();
  });

  it('filters authority URLs outside the app maternal-infant scope', () => {
    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: 'Should My Child Repeat a Grade?',
        source_url: 'https://www.healthychildren.org/English/ages-stages/gradeschool/school/Pages/Repeating-a-Grade.aspx',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'govcn-jiedu-muying',
        source_org: '中国政府网政策解读',
        question: '《关于推进儿童医疗卫生服务高质量发展的意见》解读',
        source_url: 'https://www.gov.cn/zhengce/202401/content_6925275.htm',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'ndcpa-immunization',
        source_org: '国家疾病预防控制局',
        question: '国家疾控局关于发布《疟原虫检测 免疫层析法》等13项疾病预防控制行业标准的通告',
        source_url: 'https://www.ndcpa.gov.cn/jbkzzx/c100014/common/content/content_1988800344257630208.html',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'nhs',
        source_org: 'NHS',
        question: 'Emergency contraception',
        source_url: 'https://www.nhs.uk/contraception/emergency-contraception/',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'nhs',
        source_org: 'NHS',
        question: 'Find a pharmacy that offers free flu vaccinations',
        source_url: 'https://www.nhs.uk/nhs-services/vaccination-and-booking-services/find-a-pharmacy-that-offers-free-flu-vaccinations/',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'nhs',
        source_org: 'NHS',
        question: 'Molluscum contagiosum',
        source_url: 'https://www.nhs.uk/conditions/molluscum-contagiosum/',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: 'Hotel Safety Tips for Parents of Young Children & Hidden Dangers to Watch For',
        source_url: 'https://www.healthychildren.org/English/safety-prevention/on-the-go/Pages/Hotel-Dangers-that-Put-Baby-Safety-at-Risk.aspx',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: 'Recipe: Chinese Congee',
        source_url: 'https://www.healthychildren.org/English/healthy-living/nutrition/chop-chop-magazine/Pages/Chinese-Congee.aspx',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: 'Why I Vaccinate: Childhood Measles Case Makes Mom an Advocate',
        source_url: 'https://www.healthychildren.org/English/safety-prevention/immunizations/Pages/Why-I-Vaccinate-Childhood-Measles.aspx',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: 'Does the HPV Vaccine Prevent Oral Cancer?',
        source_url: 'https://www.healthychildren.org/English/safety-prevention/immunizations/Pages/does-the-HPV-vaccine-prevent-oral-cancer.aspx',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: 'How Climate Change Can Make Children Sick: What Parents Need to Know',
        source_url: 'https://www.healthychildren.org/English/safety-prevention/all-around/Pages/how-climate-change-can-make-children-sick-what-parents-need-to-know.aspx',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: '5 Water Safety Tips for Kids of All Ages',
        source_url: 'https://www.healthychildren.org/English/safety-prevention/at-play/Pages/5-Water-Safety-Tips-for-Kids-of-all-Ages.aspx',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: 'Your Checkup Checklist: 17 Years Old',
        source_url: 'https://www.healthychildren.org/English/ages-stages/Your-Childs-Checkups/Pages/your-checkup-checklist-17-years-old.aspx',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: 'Mental Health in Teen Athletes',
        source_url: 'https://www.healthychildren.org/English/healthy-living/sports/Pages/mental-health-in-teen-athletes.aspx',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: 'Managing Screen Use During Long, Cold Winters',
        source_url: 'https://www.healthychildren.org/English/family-life/Media/Pages/managing-screen-use-during-long-cold-winters.aspx',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: 'Choosing a Child Care Center',
        source_url: 'https://www.healthychildren.org/English/family-life/work-and-child-care/Pages/choosing-a-child-care-center.aspx',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: 'Kidney Cysts in Infants, Children & Teens',
        source_url: 'https://www.healthychildren.org/English/health-issues/conditions/genitourinary-tract/Pages/Kidney-Cysts-in-Infants-Children-Teens.aspx',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: 'How Vaccines for Children & Teens Work',
        source_url: 'https://www.healthychildren.org/English/safety-prevention/immunizations/Pages/How-do-Vaccines-Work.aspx',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'nhs',
        source_org: 'NHS',
        question: 'NHS vaccinations and when to have them',
        source_url: 'https://www.nhs.uk/vaccinations/nhs-vaccinations-and-when-to-have-them/',
      }),
    ).toBe(true);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'govcn-jiedu-muying',
        source_org: '中国政府网政策解读',
        question: '《婴幼儿早期发展服务指南（试行）》文件解读',
        source_url: 'https://www.gov.cn/zhengce/202502/content_7002879.htm',
      }),
    ).toBe(false);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'nhs',
        source_org: 'NHS',
        question: 'Pregnancy, breastfeeding and fertility while taking cyclizine',
        source_url: 'https://www.nhs.uk/medicines/cyclizine/pregnancy-breastfeeding-and-fertility-while-taking-cyclizine/',
      }),
    ).toBe(false);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'nhs',
        source_org: 'NHS',
        question: 'Pregnancy vitamins and supplements',
        source_url: 'https://www.nhs.uk/pregnancy/keeping-well/pregnancy-vitamins-and-supplements/',
      }),
    ).toBe(false);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'nhs',
        source_org: 'NHS',
        question: 'Vaccinations in pregnancy',
        source_url: 'https://www.nhs.uk/pregnancy/keeping-well/vaccinations/',
      }),
    ).toBe(false);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: 'Understanding the Benefits of Vaccines: Common Questions',
        source_url: 'https://www.healthychildren.org/English/safety-prevention/immunizations/Pages/understanding-the-benefits-of-vaccines-common-questions.aspx',
      }),
    ).toBe(false);

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'aap',
        source_org: 'AAP',
        question: 'AAP Guide: Vaccines Your Child Needs by Age 6',
        source_url: 'https://www.healthychildren.org/English/safety-prevention/immunizations/Pages/Your-Babys-First-Vaccines.aspx',
      }),
    ).toBe(false);
  });

  it('blocks any title containing death-related terms (Chinese and English)', () => {
    expect(isHighRiskOrClickbaitTitle('胎死宫内的常见原因')).toBe('death_related_term');
    expect(isHighRiskOrClickbaitTitle('稽留流产后多久可以再怀孕')).toBe('death_related_term');
    expect(isHighRiskOrClickbaitTitle('新生儿窒息很要命 四大窒息原因家长须知')).toBe('death_related_term');
    expect(isHighRiskOrClickbaitTitle('婴儿猝死综合征案例分析')).toBe('death_related_term');
    expect(isHighRiskOrClickbaitTitle('溺亡儿童急救时间窗')).toBe('death_related_term');
    expect(isHighRiskOrClickbaitTitle('降低孕产妇死亡率行动计划解读')).toBe('death_related_term');
    expect(isHighRiskOrClickbaitTitle('Sudden Infant Death Syndrome (SIDS): Common Questions')).toBe('death_related_term');
    expect(isHighRiskOrClickbaitTitle('Stillbirth: causes and prevention')).toBe('death_related_term');
    expect(isHighRiskOrClickbaitTitle('Reducing infant mortality globally')).toBe('death_related_term');
  });

  it('flags death-related terms found anywhere in summary or body via the quality gate', () => {
    expect(containsDeathRelatedTerms('本周新生儿黄疸属于常见症状')).toBe(false);
    expect(containsDeathRelatedTerms('国家行动计划要求降低孕产妇死亡率')).toBe(true);
    expect(containsDeathRelatedTerms('Reducing the risk of SIDS in newborns')).toBe(true);
  });

  it('blocks sensational clickbait and mom-blaming titles', () => {
    expect(isHighRiskOrClickbaitTitle('为何脑瘫宝宝越来越多 都怪妈妈孕期做了一件事')).toBe('sensational_clickbait');
    expect(isHighRiskOrClickbaitTitle('儿童肾病后患无穷 知道该如何快速来治疗吗')).toBe('sensational_clickbait');
    expect(isHighRiskOrClickbaitTitle('这件事能诱发儿童白血病 作为家长要高度警惕')).toBe('sensational_clickbait');
    expect(isHighRiskOrClickbaitTitle('儿童性早熟多常见 早熟原因家长都不敢相信')).toBe('sensational_clickbait');
    expect(isHighRiskOrClickbaitTitle('改善宝宝枕秃的有效措施在这里 妈妈赶紧拿去用')).toBe('sensational_clickbait');
    expect(isHighRiskOrClickbaitTitle('宝宝有睡眠障碍怎么办？不妨试试这6招')).toBe('sensational_clickbait');
    expect(isHighRiskOrClickbaitTitle('儿童挑食智力受损 几种方法改善儿童挑食现象')).toBe('sensational_clickbait');
    expect(isHighRiskOrClickbaitTitle('无痛分娩：让分娩不再痛不欲生')).toBe('sensational_clickbait');
  });

  it('blocks pseudo-medical gender-selection content', () => {
    expect(isHighRiskOrClickbaitTitle('如何备孕生女孩')).toBe('pseudo_medical_gender_selection');
    expect(isHighRiskOrClickbaitTitle('二胎备孕男孩吃什么')).toBe('pseudo_medical_gender_selection');
    expect(isHighRiskOrClickbaitTitle('二胎备孕男孩秘诀')).toBe('pseudo_medical_gender_selection');
    expect(isHighRiskOrClickbaitTitle('生男生女秘诀提前知道')).toBe('pseudo_medical_gender_selection');
    expect(isHighRiskOrClickbaitTitle('清宫表预测生男生女准吗')).toBe('pseudo_medical_gender_selection');
  });

  it('keeps legitimate maternal-baby titles that mention boys/girls or pregnancy weeks', () => {
    expect(isHighRiskOrClickbaitTitle('孕期全指导：怀孕第40周')).toBeNull();
    expect(isHighRiskOrClickbaitTitle('女孩青春期发育时间表')).toBeNull();
    expect(isHighRiskOrClickbaitTitle('男宝宝包皮护理常识')).toBeNull();
    expect(isHighRiskOrClickbaitTitle('儿子半夜发烧怎么处理')).toBeNull();
  });

  it('rejects high-sensitivity articles through the shared document quality gate', () => {
    const document = {
      sourceId: 'familydoctor-maternal',
      sourceOrg: '家庭医生在线',
      sourceUrl: 'https://www.familydoctor.com.cn/baby/a/201806/2487075.html',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '新生儿窒息很要命 四大窒息原因家长须知',
      updatedAt: undefined,
      audience: '婴幼儿家长',
      topic: 'common-symptoms',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '介绍新生儿窒息的四大原因。',
      contentText: '新生儿窒息的常见原因包括产程异常、脐带因素、胎盘功能不全等。'.repeat(8),
      metadataJson: {},
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(document).decision).toBe('reject');
    expect(shouldPublishDocument(document)).toBe('rejected');
  });

  it('rejects low-quality third-party medical-platform articles before publishing', () => {
    const noisyDocument = {
      sourceId: 'yilianmeiti-maternal-child',
      sourceOrg: '医联媒体',
      sourceUrl: 'https://www.yilianmeiti.com/article/2934661.html',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '哺乳期可以喝酒吗？酒精对宝宝的影响要知道',
      updatedAt: '2026-03-01T00:00:00.000Z',
      audience: '产后妈妈',
      topic: 'feeding',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '好多新手妈妈在哺乳期时，都被“能不能喝酒”这个问题给难住了🤔。',
      contentText: '今天咱就来好好唠唠哺乳期饮酒这事儿。'.repeat(30),
      metadataJson: { sourceClass: 'medical_platform' },
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(noisyDocument).reasons).toContain('medical_platform_noisy_title');
    expect(shouldPublishDocument(noisyDocument)).toBe('rejected');

    const oldDocument = {
      sourceId: 'familydoctor-maternal',
      sourceOrg: '家庭医生在线',
      sourceUrl: 'https://www.familydoctor.com.cn/baby/a/201503/752536.html',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '新生儿疾病小心黄疸湿疹 保健新生儿疾病注意哺乳',
      updatedAt: '2015-03-27T09:06:09',
      audience: '婴幼儿家长',
      topic: 'common-symptoms',
      region: 'CN',
      riskLevelDefault: 'yellow' as const,
      summary: '介绍新生儿常见疾病。',
      contentText: '新生儿常见护理问题包括黄疸、湿疹、吐奶、腹泻等，家长应注意观察精神状态、吃奶和排便情况。'.repeat(20),
      metadataJson: { sourceClass: 'medical_platform' },
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(oldDocument).reasons).toContain('medical_platform_noisy_title');
    expect(shouldPublishDocument(oldDocument)).toBe('rejected');

    const caseNewsDocument = {
      sourceId: 'yilianmeiti-maternal-child',
      sourceOrg: '医联媒体',
      sourceUrl: 'https://www.yilianmeiti.com/article/2932205.html',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '腹胀如孕妇，8岁女孩竟患上卵巢恶性肿瘤，专家：“拆弹”保生育',
      updatedAt: '2026-03-01T00:00:00.000Z',
      audience: '母婴家庭',
      topic: 'common-symptoms',
      region: 'CN',
      riskLevelDefault: 'yellow' as const,
      summary: '医院团队通过多学科协作与精准手术处理复杂病例。',
      contentText: '患儿因腹胀住院，医生检查后发现恶性肿瘤并进行手术切除。'.repeat(20),
      metadataJson: { sourceClass: 'medical_platform' },
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(caseNewsDocument).reasons).toContain('medical_platform_severe_case_news');
    expect(shouldPublishDocument(caseNewsDocument)).toBe('rejected');

    const kepuchinaTeamProfile = {
      sourceId: 'kepuchina-maternal-child',
      sourceOrg: '科普中国',
      sourceUrl: 'https://www.kepuchina.cn/article/articleinfo?business_type=100&classify=0&ar_id=440996',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '仁医妇产母乳喂养科普团队：营造关爱母乳喂养良好氛围',
      updatedAt: '2023-12-01',
      audience: '产后妈妈',
      topic: 'feeding',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '2023年度科普团队介绍。',
      contentText: '该团队长期开展母乳喂养科普活动，介绍团队建设、项目经验和社会服务情况。'.repeat(30),
      metadataJson: { sourceClass: 'medical_platform' },
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(kepuchinaTeamProfile).reasons).toContain('medical_platform_noisy_title');
    expect(shouldPublishDocument(kepuchinaTeamProfile)).toBe('rejected');

    const kepuchinaCasualStory = {
      sourceId: 'kepuchina-maternal-child',
      sourceOrg: '科普中国',
      sourceUrl: 'https://www.kepuchina.cn/article/articleinfo?business_type=100&classify=0&ar_id=66617',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '吃母乳就是母乳喂养？',
      updatedAt: '2023-06-01',
      audience: '产后妈妈',
      topic: 'feeding',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '母乳喂养指导。',
      contentText: '同部门的小李最近升级做了新手妈妈，每天微信朋友圈是各种晒娃，初为人母的幸福可谓溢于言表。一天微信聊天时，她吐槽喂养过程很累。'.repeat(20),
      metadataJson: { sourceClass: 'medical_platform' },
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(kepuchinaCasualStory).reasons).toContain('medical_platform_casual_or_promotional');
    expect(shouldPublishDocument(kepuchinaCasualStory)).toBe('rejected');

    const yilianCaseNews = {
      sourceId: 'yilianmeiti-maternal-child',
      sourceOrg: '医联媒体',
      sourceUrl: 'https://www.yilianmeiti.com/article/2953986.html',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '28+2周龙凤胎54天闯关出院！南医增城院区医护托起“掌心宝宝”生命奇迹',
      updatedAt: '2026-04-01T00:00:00.000Z',
      audience: '婴幼儿家长',
      topic: 'newborn',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '一对出生体重较低的龙凤胎在医护团队精准救治下闯过重重生命关卡。',
      contentText: '近日，医院儿童中心上演团聚画面，医护团队托起掌心宝宝生命奇迹，文章主要介绍病例救治过程和团队协作。'.repeat(20),
      metadataJson: { sourceClass: 'medical_platform' },
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(yilianCaseNews).reasons).toContain('medical_platform_severe_case_news');
    expect(shouldPublishDocument(yilianCaseNews)).toBe('rejected');
  });

  it('requires Haodf doctor-authored professional signals and rejects repost-like content', () => {
    const missingProfessionalSignal = {
      sourceId: 'haodf-maternal-child',
      sourceOrg: '好大夫在线',
      sourceUrl: 'https://www.haodf.com/neirong/wenzhang/9394363019.html',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '婴幼儿退热用药原则',
      updatedAt: '2025-05-12',
      audience: '婴幼儿家长',
      topic: 'common-symptoms',
      region: 'CN',
      riskLevelDefault: 'yellow' as const,
      summary: '婴幼儿发热用药需要结合月龄、体重、精神状态和药品浓度。',
      contentText: '婴幼儿发热时应观察精神状态、吃奶饮水、尿量、呼吸和皮肤颜色，按照体重核对药品剂量，避免重复使用同类成分。三个月以下婴儿发热不建议自行用药，应尽快联系儿科医生评估。'.repeat(8),
      metadataJson: { sourceClass: 'medical_platform' },
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(missingProfessionalSignal).reasons).toContain('medical_platform_missing_professional_signal');
    expect(shouldPublishDocument(missingProfessionalSignal)).toBe('rejected');

    const repostDocument = {
      ...missingProfessionalSignal,
      contentText: '王医生 主任医师 北京儿童医院 儿科。转自其他平台的科普文章，未体现医生本人原创发表，不适合进入自动知识库。'.repeat(10),
    };

    expect(evaluateAuthorityDocumentQuality(repostDocument).reasons).toContain('medical_platform_repost_or_forum_content');
    expect(shouldPublishDocument(repostDocument)).toBe('rejected');
  });

  it('keeps third-party Chinese medical-platform guidance out of the app-review knowledge cache', () => {
    const document = {
      sourceId: 'youlai-pregnancy-guide',
      sourceOrg: '有来医生',
      sourceUrl: 'https://m.youlai.cn/special/advisor/dOP09kv7LD.html',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '孕期体重管理和营养建议',
      updatedAt: '2025-03-01T00:00:00.000Z',
      audience: '孕妇',
      topic: 'pregnancy',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '孕期体重管理应结合孕前体重、孕周和胎儿发育情况。',
      contentText: '孕期体重管理应结合孕前体重、孕周和胎儿发育情况，饮食上保持主食、优质蛋白、蔬菜水果和奶类摄入，避免长期高糖高油饮食。若体重增长过快或过慢，应咨询产科医生并结合产检结果调整。'.repeat(8),
      metadataJson: { sourceClass: 'medical_platform' },
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(document).reasons).toContain('medical_platform_app_review_restricted');
    expect(shouldPublishDocument(document)).toBe('rejected');
  });

  it('rejects short third-party medical-platform guidance instead of sending it to review', () => {
    const document = {
      sourceId: 'dayi-maternal-child',
      sourceOrg: '中国医药信息查询平台',
      sourceUrl: 'https://www.dayi.org.cn/qa/153633.html',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '孕妇脚痒怎么办',
      updatedAt: '2025-11-17T14:08:18.000+00:00',
      audience: '孕妇',
      topic: 'pregnancy',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '孕妇脚痒需要结合孕周、皮疹和产检情况评估。',
      contentText: '审核医生：李若瑜 主任医师 北京大学第一医院。孕妇脚痒可见于正常生理现象，也可能与足癣、妊娠期肝内胆汁淤积症等因素有关。建议保持皮肤清洁，避免热水烫洗和过度抓挠，若瘙痒持续或伴随其他异常，应到产科或皮肤科就诊。'.repeat(3),
      metadataJson: { sourceClass: 'medical_platform' },
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(document).reasons).toContain('medical_platform_app_review_restricted');
    expect(shouldPublishDocument(document)).toBe('rejected');
  });

  it('rejects Dayi structured guidance even when appointment and hospitalization wording is normal', () => {
    const document = {
      sourceId: 'dayi-maternal-child',
      sourceOrg: '中国医药信息查询平台',
      sourceUrl: 'https://www.dayi.org.cn/symptom/1142681.html',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '孕妇腿抽筋',
      updatedAt: '2025-11-17T14:08:18.000+00:00',
      audience: '孕妇',
      topic: 'pregnancy',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '孕妇腿抽筋多与缺钙、疲劳、寒冷和睡姿不当等因素有关。',
      contentText: '审核医生：杨慧霞 主任医师 北京大学第一医院。孕妇腿抽筋多与缺钙、疲劳、寒冷和睡姿不当有关。就医准备包括提前预约挂号，携带身份证、医保卡、检查报告和近期用药记录。患者可以询问医生是否需要住院、是否需要补钙、如何调整饮食和睡眠姿势。医生会结合体格检查和电解质检查评估原因，并给出适合孕期的处理建议。'.repeat(8),
      metadataJson: { sourceClass: 'medical_platform' },
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(document).reasons).toContain('medical_platform_app_review_restricted');
    expect(shouldPublishDocument(document)).toBe('rejected');
  });

  it('still rejects promotional Dayi-like pages when promotional wording appears', () => {
    const document = {
      sourceId: 'dayi-maternal-child',
      sourceOrg: '中国医药信息查询平台',
      sourceUrl: 'https://www.dayi.org.cn/qa/999999.html',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '孕妇水肿怎么办',
      updatedAt: '2025-11-17T14:08:18.000+00:00',
      audience: '孕妇',
      topic: 'pregnancy',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '孕妇水肿需要结合孕周和血压情况评估。',
      contentText: '孕妇水肿需要结合孕周、血压、尿蛋白和体重增长情况评估。医院哪家好可以免费咨询在线问诊，排行榜口碑即时公开。'.repeat(12),
      metadataJson: { sourceClass: 'medical_platform' },
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(document).reasons).toContain('medical_platform_casual_or_promotional');
    expect(shouldPublishDocument(document)).toBe('rejected');
  });

  it('rejects off-topic gov.cn policy summaries through the shared document quality gate', () => {
    const document = {
      sourceId: 'govcn-jiedu-muying',
      sourceOrg: '中国政府网政策解读',
      sourceUrl: 'https://www.gov.cn/zhengce/202509/content_7041251.htm',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '托育、养老、文旅......这些产业迎利好！',
      updatedAt: undefined,
      audience: '婴幼儿家长',
      topic: 'policy',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '商务部等9部门联合印发《关于扩大服务消费的若干政策措施》。',
      contentText: '商务部等9部门印发《关于扩大服务消费的若干政策措施》，涉及消费新业态、餐饮住宿、文旅、养老托育、家政服务等领域的政策利好。'.repeat(4),
      metadataJson: {},
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(document).decision).toBe('reject');
    expect(shouldPublishDocument(document)).toBe('rejected');
  });

  it('marks image/PDF-style official pages as OCR candidates without auto-publishing short text', () => {
    const document = {
      sourceId: 'cnsoc-dietary-guidelines',
      sourceOrg: '中国营养学会/中国居民膳食指南',
      sourceUrl: 'http://dg.cnsoc.org/article/04/gc5cUak3RhSGheqSaRljnA.html',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '《中国婴幼儿喂养指南（2022）》核心信息',
      updatedAt: undefined,
      audience: '婴幼儿家长',
      topic: 'feeding',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '图片版核心信息。',
      contentText: '清晰版图形请前往图示和工具。',
      metadataJson: { imageCount: 6 },
      publishStatus: 'draft' as const,
    };

    const quality = evaluateAuthorityDocumentQuality(document);
    expect(quality.decision).toBe('pass');
    expect(quality.ocrCandidate).toBe(true);
    expect(shouldPublishDocument(document)).toBe('rejected');
  });

  it('rejects thin English authority articles by readable word count', () => {
    const shortBody = [
      'Maintaining body temperature involves calories and oxygen.',
      'The more energy your baby uses to keep warm, the less he will have for growing and healing.',
      'Your baby will progress from the incubator or radiant warmer to an open crib based on his ability to regulate body temperature.',
      'This ability depends, in part, on gestational age and weight.',
      'The transition is usually gradual, but your baby may be returned to the warmer environment at the first sign of inability to maintain temperature.',
      'It is not unusual for a baby weight gain to slow during the weaning process to an open crib.',
    ].join(' ');
    const document = {
      sourceId: 'aap',
      sourceOrg: 'AAP',
      sourceUrl: 'https://www.healthychildren.org/English/ages-stages/baby/preemie/Pages/transitioning-to-a-crib.aspx',
      sourceLanguage: 'en' as const,
      sourceLocale: 'en-US',
      title: 'Transitioning to a Crib in the NICU',
      updatedAt: '2026-04-09T03:01:03.000Z',
      audience: '婴幼儿家长',
      topic: 'newborn',
      region: 'US',
      riskLevelDefault: 'green' as const,
      summary: 'The American Academy of Pediatrics discusses transitioning to a crib.',
      contentText: shortBody,
      metadataJson: {},
      publishStatus: 'draft' as const,
    };

    const quality = evaluateAuthorityDocumentQuality(document);
    expect(quality.reasons).toContain('english_authority_short_content');
    expect(shouldPublishDocument(document)).toBe('rejected');
    expect(getAuthorityKnowledgeDropReason({
      sourceId: 'aap',
      sourceLanguage: 'en',
      title: document.title,
      summary: document.summary,
      answer: shortBody,
      sourceUrl: document.sourceUrl,
    })).toBe('english_authority_short_content');
  });

  it('keeps substantive English authority guidance above the thin-content floor', () => {
    const body = [
      'Breastfeeding positions can help parents keep the baby close, comfortable, and well supported during feeds.',
      'Parents can watch for rhythmic sucking, relaxed hands, audible swallowing, and steady wet diapers as signs that milk transfer is going well.',
      'If nipples hurt, the baby slips off the breast, or feeding sessions feel unusually long, parents can adjust positioning and ask a lactation professional for help.',
      'Good support also means keeping water nearby, resting the baby on pillows when needed, and switching sides based on the baby cues rather than a fixed clock.',
      'Families should seek medical care if the baby has too few wet diapers, poor weight gain, fever, unusual sleepiness, or persistent feeding difficulty.',
    ].join(' ').repeat(2);
    const document = {
      sourceId: 'aap',
      sourceOrg: 'AAP',
      sourceUrl: 'https://www.healthychildren.org/English/ages-stages/baby/breastfeeding/Pages/breastfeeding-positions.aspx',
      sourceLanguage: 'en' as const,
      sourceLocale: 'en-US',
      title: 'Breastfeeding Positions for Your Baby',
      updatedAt: '2026-04-09T02:57:35.000Z',
      audience: '婴幼儿家长',
      topic: 'feeding',
      region: 'US',
      riskLevelDefault: 'green' as const,
      summary: 'Guidance for breastfeeding parents and babies.',
      contentText: body,
      metadataJson: {},
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(document).decision).toBe('pass');
    expect(shouldPublishDocument(document)).toBe('published');
    expect(getAuthorityKnowledgeDropReason({
      sourceId: 'aap',
      sourceLanguage: 'en',
      title: document.title,
      summary: document.summary,
      answer: body,
      sourceUrl: document.sourceUrl,
    })).toBeNull();
  });

  it('rejects foreign local emergency instructions from English authority content', () => {
    const body = [
      'Jaundice is common in newborn babies and usually improves with feeding and observation.',
      'Parents should ask for an urgent GP or midwife appointment or call NHS 111 if the baby is over 24 hours old and symptoms are getting worse.',
      'Call 999 if the baby is difficult to wake, has breathing problems, or seems seriously unwell.',
    ].join(' ').repeat(6);

    expect(getAuthorityKnowledgeDropReason({
      sourceId: 'nhs',
      sourceLanguage: 'en',
      title: 'Jaundice in babies',
      summary: 'NHS guidance about jaundice symptoms in newborn babies.',
      answer: body,
      sourceUrl: 'https://www.nhs.uk/conditions/jaundice-in-babies/',
    })).toBe('foreign_emergency_instruction');
  });

  it('does not reject benign English numbers without emergency-service wording', () => {
    const body = [
      'This infant feeding guide compares weight changes across pages 99 and 111 of the local booklet.',
      'A study table includes values from 9 to 99 and a sample code 999 for indexing records.',
      'Parents can track wet diapers, feeding frequency, and baby weight gain with their clinician.',
    ].join(' ').repeat(8);

    expect(getAuthorityKnowledgeDropReason({
      sourceId: 'aap',
      sourceLanguage: 'en',
      title: 'Tracking baby feeding and weight',
      summary: 'Guidance for parents of newborn babies.',
      answer: body,
      sourceUrl: 'https://www.healthychildren.org/English/ages-stages/baby/feeding/Pages/tracking-feeds.aspx',
    })).toBeNull();
  });

  it('rejects Chinese official training, meeting, and activity pages from guidance sources', () => {
    const lowValueOfficialRecords = [
      {
        source_id: 'nhc-fys',
        source_org: '国家卫生健康委员会妇幼健康司',
        source_url: 'https://www.nhc.gov.cn/fys/s3581/202604/1234567890abcdef1234567890abcdef.shtml',
        question: '儿童青少年“五健”促进行动启动',
      },
      {
        source_id: 'chinacdc-immunization',
        source_org: '中国疾病预防控制中心',
        source_url: 'https://www.chinacdc.cn/jkkp/mygh/ztrxc/202604/t20260420_305001.html',
        question: '国疾控综卫免函〔2026〕79号',
      },
      {
        source_id: 'ndcpa-immunization',
        source_org: '国家疾病预防控制局',
        source_url: 'https://www.ndcpa.gov.cn/jbkzzx/c100014/common/content/content_1988800344257630208.html',
        question: '2026年全国儿童预防接种日主题宣传海报发布',
      },
      {
        source_id: 'ndcpa-immunization',
        source_org: '国家疾病预防控制局',
        source_url: 'https://www.ndcpa.gov.cn/jbkzzx/c100014/common/content/content_1988800344257630209.html',
        question: '国家疾控局综合司关于组织开展2026年全国儿童预防接种日宣传活动的通知',
      },
      {
        source_id: 'ndcpa-immunization',
        source_org: '国家疾病预防控制局',
        source_url: 'https://www.ndcpa.gov.cn/jbkzzx/c100014/common/content/content_1988800344257630210.html',
        question: '2026年全国卫生与免疫规划工作会议召开',
      },
      {
        source_id: 'nhc-fys',
        source_org: '国家卫生健康委员会妇幼健康司',
        source_url: 'https://www.nhc.gov.cn/fys/s3581/202603/1234567890abcdef1234567890abcdee.shtml',
        question: '全国儿童青少年“五健”促进行动政策宣贯电视电话会议在京召开',
      },
      {
        source_id: 'nhc-fys',
        source_org: '国家卫生健康委员会妇幼健康司',
        source_url: 'https://www.nhc.gov.cn/fys/s3581/202604/1234567890abcdef1234567890abcdff.shtml',
        question: '世界母乳喂养周宣传日活动在京举办',
      },
      {
        source_id: 'nhc-fys',
        source_org: '国家卫生健康委员会妇幼健康司',
        source_url: 'https://www.nhc.gov.cn/fys/c100077/202512/156aee28a1f543f1a3301ab92580a48b.shtml',
        question: '《儿童青少年“五健”促进行动计划（2026-2030年）》解读',
      },
      {
        source_id: 'nhc-rkjt',
        source_org: '国家卫生健康委员会人口监测与家庭发展司',
        source_url: 'https://www.nhc.gov.cn/rkjcyjtfzs/c100147/202601/1234567890abcdef1234567890abcd01.shtml',
        question: '2026年全国人口家庭发展工作会议在京召开',
      },
      {
        source_id: 'nhc-fys',
        source_org: '国家卫生健康委员会妇幼健康司',
        source_url: 'https://www.nhc.gov.cn/fys/c100077/202601/1234567890abcdef1234567890abcd02.shtml',
        question: '2026年全国妇幼健康工作会议在京召开',
      },
      {
        source_id: 'nhc-rkjt',
        source_org: '国家卫生健康委员会人口监测与家庭发展司',
        source_url: 'https://www.nhc.gov.cn/rkjcyjtfzs/c100147/202512/1234567890abcdef1234567890abcd03.shtml',
        question: '关于开展2025年全国托育服务宣传月活动的通知',
      },
      {
        source_id: 'ndcpa-public-health',
        source_org: '国家疾病预防控制局',
        source_url: 'https://www.ndcpa.gov.cn/jbkzzx/c100008/common/content/content_1988800344257630211.html',
        question: '2025年全国预防接种职业技能竞赛决赛成功举办',
      },
      {
        source_id: 'ndcpa-public-health',
        source_org: '国家疾病预防控制局',
        source_url: 'https://www.ndcpa.gov.cn/jbkzzx/c100008/common/content/content_1988800344257630212.html',
        question: '全国128名预防接种职业技能精英将在青岛同台竞技',
      },
      {
        source_id: 'nhc-fys',
        source_org: '国家卫生健康委员会妇幼健康司',
        source_url: 'https://www.nhc.gov.cn/fys/c100077/202508/1234567890abcdef1234567890abcd04.shtml',
        question: '妇幼司发布2025年预防出生缺陷日主题和海报',
      },
      {
        source_id: 'nhc-rkjt',
        source_org: '国家卫生健康委员会人口监测与家庭发展司',
        source_url: 'https://www.nhc.gov.cn/rkjcyjtfzs/c100147/202508/1234567890abcdef1234567890abcd05.shtml',
        question: '中华全国总工会 国家卫生健康委员会 中华全国妇女联合会关于举办2025年职工托育职业技能大赛的通知',
      },
      {
        source_id: 'nhc-rkjt',
        source_org: '国家卫生健康委员会人口监测与家庭发展司',
        source_url: 'https://www.nhc.gov.cn/rkjcyjtfzs/c100147/202505/1234567890abcdef1234567890abcd06.shtml',
        question: '2025年国际家庭日主题宣传活动暨全国托育服务宣传月启动仪式在哈尔滨举办',
      },
      {
        source_id: 'nhc-rkjt',
        source_org: '国家卫生健康委员会人口监测与家庭发展司',
        source_url: 'https://www.nhc.gov.cn/rkjcyjtfzs/c100147/202306/1d627d4372924202a73d3a82c730e0b0.shtml',
        question: '全国婴幼儿照护服务示范城市现场经验交流会在山东济宁召开',
      },
      {
        source_id: 'nhc-fys',
        source_org: '国家卫生健康委员会妇幼健康司',
        source_url: 'https://www.nhc.gov.cn/fys/c100077/202409/de98d52489ac4680a9b134127f9f6718.shtml',
        question: '关于儿童保健与婴幼儿养育照护科普作品征集评选活动评选结果的公示',
      },
      {
        source_id: 'nhc-fys',
        source_org: '国家卫生健康委员会妇幼健康司',
        source_url: 'https://www.nhc.gov.cn/fys/c100078/202308/070f3e53423e4b51bf4221666bfbb57b.shtml',
        question: '国家卫生健康委办公厅关于开展儿童保健与婴幼儿养育照护科普作品征集评选活动的通知',
      },
      {
        source_id: 'chinacdc-immunization',
        source_org: '中国疾病预防控制中心',
        source_url: 'https://www.chinacdc.cn/jkyj/mygh02/jswj_mygh/myfw_mygh/202505/t20250528_300934.html',
        question: '附件： 预防接种工作规范（2016年版）',
      },
      {
        source_id: 'chinacdc-immunization',
        source_org: '中国疾病预防控制中心',
        source_url: 'https://www.chinacdc.cn/jkyj/mygh02/jswj_mygh/myfw_mygh/202505/t20250530_300935.html',
        question: '为贯彻温家宝总理在十届全国人大五次会议上提出的“扩大国家免疫规划范围，将甲肝、流脑等１５种可以通过接种疫苗有效预防的传染病纳入国家免疫规划”的精神，落实扩大国家免疫规划的目标和任务，规范和指导各地科学实施扩大国家免疫规划工作，有效预防和控制相关传染病，制订本方案。',
      },
      {
        source_id: 'chinacdc-nutrition',
        source_org: '中国疾病预防控制中心营养与健康所',
        source_url: 'https://www.chinacdc.cn/jkkp/yyjk/rqyy/202603/t20260323_315315.html',
        question: '中国疾病预防控制中心',
      },
      {
        source_id: 'chinacdc-nutrition',
        source_org: '中国疾病预防控制中心营养与健康所',
        source_url: 'https://www.chinacdc.cn/jkkp/yyjk/rqyy/202602/t20260224_315001.html',
        question: '“ 二十五，磨豆腐。”一句民谚，不仅勾勒出年关将至的忙碌与期待，更蕴含着中国人对健康与富足的美好祈愿。',
      },
      {
        source_id: 'chinacdc-nutrition',
        source_org: '中国疾病预防控制中心营养与健康所',
        source_url: 'https://www.chinacdc.cn/jkkp/yyjk/rqyy/202408/t20240825_295586.html',
        question: '我国 6～17岁学龄儿童主要食物摄入量存在地区差异',
      },
      {
        source_id: 'chinacdc-nutrition',
        source_org: '中国疾病预防控制中心营养与健康所',
        source_url: 'https://www.chinacdc.cn/jkkp/yyjk/swyy/202408/t20240825_295598.html',
        question: '清明时节话饮食、护健康',
      },
      {
        source_id: 'chinacdc-nutrition',
        source_org: '中国疾病预防控制中心营养与健康所',
        source_url: 'https://www.chinacdc.cn/jkkp/yyjk/rqyy/202408/t20240825_295589.html',
        question: '素食人群是指以不吃畜肉、家禽、海鲜、蛋、奶等动物性食物为饮食方式的人群。完全戒食动物性食品及其产品的为全素人群；不戒食蛋奶类及其相关产品的为蛋奶素人群。根据统计，我国目前素食人群已超过 5000万，其中女性较高。',
      },
    ];

    lowValueOfficialRecords.forEach((record) => {
      expect(shouldFilterAuthoritySourceUrl(record)).toBe(true);
      // These are all low-value official records that must be dropped. Most are
      // caught by the official_chinese activity/admin/navigation gate, but a few
      // event-announcement titles (e.g. "...启动仪式在哈尔滨举办") legitimately match
      // the news/information gate, which runs first. Either is a correct rejection.
      expect(getAuthorityKnowledgeDropReason(record)).toMatch(
        /^(official_chinese_|news_or_information_content$)/,
      );
    });

    [
      {
        source_id: 'ndcpa-immunization',
        source_org: '国家疾病预防控制局',
        source_url: 'https://www.ndcpa.gov.cn/jbkzzx/c100014/common/content/content_1961007702056800256.html',
        question: '全国儿童预防接种日宣传核心信息',
      },
      {
        source_id: 'nhc-fys',
        source_org: '国家卫生健康委员会妇幼健康司',
        source_url: 'https://www.nhc.gov.cn/fys/s3581/202604/1234567890abcdef1234567890abcddd.shtml',
        question: '婴幼儿营养喂养评估服务指南（试行）',
      },
      {
        source_id: 'chinacdc-immunization',
        source_org: '中国疾病预防控制中心',
        source_url: 'https://www.chinacdc.cn/jkyj/mygh02/jswj_mygh/myfw_mygh/202409/t20240925_300934.html',
        question: '国家免疫规划疫苗儿童免疫程序及说明（2024年版）',
      },
      {
        source_id: 'nhc-fys',
        source_org: '国家卫生健康委员会妇幼健康司',
        source_url: 'https://www.nhc.gov.cn/fys/s3581/202604/1234567890abcdef1234567890abcddc.shtml',
        question: '中国婴幼儿喂养指南发布',
      },
    ].forEach((record) => {
      expect(shouldFilterAuthoritySourceUrl(record)).toBe(false);
      expect(getAuthorityKnowledgeDropReason(record)).toBeNull();
    });

    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'mchscn-monitoring',
        source_url: 'https://www.mchscn.cn/MaternalSafetyMonitoring-26/682.html',
        question: '全国妇幼卫生监测培训班在京举办',
      }),
    ).toBe(true);
    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'chinanutri-maternal-child',
        source_url: 'https://www.chinanutri.cn/xwzx_238/xyxw/202505/t20250519_306901.html',
        question: '营养所工会举办妇女节活动',
      }),
    ).toBe(true);
    expect(
      shouldFilterAuthoritySourceUrl({
        source_id: 'ncwch-maternal-child-health',
        source_url: 'https://www.ncwchnhc.org.cn/content/content.html?id=7313481602116358144',
        question: '体重管理指导原则（2024年版）—孕前、孕期及产后女性体重管理',
      }),
    ).toBe(false);

    const document = {
      sourceId: 'ncwch-maternal-child-health',
      sourceOrg: '国家卫生健康委妇幼健康中心',
      sourceUrl: 'https://www.ncwchnhc.org.cn/content/content.html?id=7374642712508633088',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '妇幼健康服务能力提升培训班通知',
      updatedAt: undefined,
      audience: '孕妇',
      topic: 'pregnancy',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '培训班报名通知和会议安排。',
      contentText: '本通知介绍培训班报名、会议安排、参会人员和报到地点。'.repeat(20),
      metadataJson: {},
      publishStatus: 'draft' as const,
    };

    expect(evaluateAuthorityDocumentQuality(document).reasons).toContain('official_chinese_activity_or_admin');
    expect(shouldPublishDocument(document)).toBe('rejected');
    expect(getAuthorityKnowledgeDropReason({
      sourceId: document.sourceId,
      sourceOrg: document.sourceOrg,
      sourceUrl: document.sourceUrl,
      question: document.title,
      summary: document.summary,
      answer: document.contentText,
    })).toBe('official_chinese_activity_or_admin');
  });

  it('rejects Chinese official navigation shells and admin form pages from guidance sources', () => {
    const cnsocShell = {
      sourceId: 'cnsoc-dietary-guidelines',
      sourceOrg: '中国营养学会/中国居民膳食指南',
      sourceUrl: 'http://dg.cnsoc.org/article/04/hjgfxca3Ra69sKbvqDETbg.html',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '《中国孕妇、乳母膳食指南（2022）》核心信息',
      updatedAt: undefined,
      audience: '孕妇',
      topic: 'feeding',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '核心信息。',
      contentText: '宣传和培训 2022版平衡膳食八准则 2022版解读工作会议国际交流其它中国居民膳食指南（2022） 联系我们地址： 北京市西城区广安门内大街6号 电话：010-83554781 传真：010-83554780 E-mail：dg@cnsoc.org',
      metadataJson: {},
      publishStatus: 'draft' as const,
    };
    expect(evaluateAuthorityDocumentQuality(cnsocShell).reasons).toContain('official_chinese_navigation_shell');
    expect(shouldPublishDocument(cnsocShell)).toBe('rejected');
    expect(getAuthorityKnowledgeDropReason({
      sourceId: cnsocShell.sourceId,
      question: cnsocShell.title,
      summary: cnsocShell.summary,
      answer: cnsocShell.contentText,
    })).toBe('official_chinese_navigation_shell');

    const mchscnFormPage = {
      sourceId: 'mchscn-monitoring',
      sourceOrg: '中国妇幼健康监测系统',
      sourceUrl: 'https://www.mchscn.cn/ChildHealthMonitoring-27/684.html',
      sourceLanguage: 'zh' as const,
      sourceLocale: 'zh-CN',
      title: '儿童营养监测表卡及项目数标注（2025）',
      updatedAt: undefined,
      audience: '婴幼儿家长',
      topic: 'nutrition',
      region: 'CN',
      riskLevelDefault: 'green' as const,
      summary: '表卡项目数说明。',
      contentText: '儿童营养监测表卡项目数说明，包含系统填报字段和表卡项目数量。'.repeat(8),
      metadataJson: {},
      publishStatus: 'draft' as const,
    };
    expect(evaluateAuthorityDocumentQuality(mchscnFormPage).reasons).toContain('official_chinese_admin_or_form_page');
    expect(shouldPublishDocument(mchscnFormPage)).toBe('rejected');
  });
});

describe('authority quality tier configuration', () => {
  it('allocates a larger per-run fetch budget to higher tiers', () => {
    expect(getTierFetchBudget('A')).toBe(200);
    expect(getTierFetchBudget('B')).toBe(120);
    expect(getTierFetchBudget('C')).toBe(40);
    // Unknown / missing tiers fall back to the most conservative budget.
    expect(getTierFetchBudget(undefined)).toBe(40);
  });

  it('holds lower tiers to a stricter content-length and confidence bar', () => {
    expect(getTierQualityThreshold('A')).toEqual({ minContentLength: 160, minAiConfidence: 0.5 });
    expect(getTierQualityThreshold('B')).toEqual({ minContentLength: 220, minAiConfidence: 0.6 });
    expect(getTierQualityThreshold('C')).toEqual({ minContentLength: 320, minAiConfidence: 0.7 });
    expect(getTierQualityThreshold(undefined)).toEqual({ minContentLength: 320, minAiConfidence: 0.7 });
  });
});

describe('tier-aware official Chinese content gating', () => {
  // A plain ~192-char guidance body that does not trip any activity/admin or
  // navigation patterns and whose title is not a recognized core-guidance page.
  const shortBody = '孕期保持均衡饮食有助于母婴健康，建议合理搭配蔬菜水果与优质蛋白。'.repeat(6);

  const baseRecord = {
    sourceId: 'nhc-fys',
    title: '孕期日常饮食安排说明',
    summary: '孕期日常饮食安排说明。',
    contentText: shortBody,
  };

  it('keeps a 192-char body for a top-tier source (threshold 160)', () => {
    expect(shortBody.length).toBe(192);
    expect(getOfficialChineseAuthorityQualityDropReason(baseRecord, 'A')).toBeNull();
  });

  it('drops the same body for mid and low tiers (thresholds 220 / 320)', () => {
    expect(getOfficialChineseAuthorityQualityDropReason(baseRecord, 'B'))
      .toBe('official_chinese_short_content');
    expect(getOfficialChineseAuthorityQualityDropReason(baseRecord, 'C'))
      .toBe('official_chinese_short_content');
  });

  it('routes the tier override through getAuthorityKnowledgeDropReason', () => {
    expect(getAuthorityKnowledgeDropReason({ ...baseRecord, qualityTier: 'A' })).toBeNull();
    expect(getAuthorityKnowledgeDropReason({ ...baseRecord, qualityTier: 'C' }))
      .toBe('official_chinese_short_content');
  });

  it('never lets the tier override bypass the death-related term gate', () => {
    // Even the most lenient tier (A) and a trusted source must still drop
    // death/sensitive content so it never reaches the knowledge base.
    expect(getAuthorityKnowledgeDropReason({
      sourceId: 'who',
      qualityTier: 'A',
      question: '胎死宫内的常见原因',
      answer: '相关内容。',
    })).toBe('death_related_term');

    expect(getAuthorityKnowledgeDropReason({
      sourceId: 'nhc-fys',
      qualityTier: 'A',
      question: '孕期营养指南核心信息',
      answer: '国家行动计划要求降低孕产妇死亡率，'.repeat(10),
    })).toBe('death_related_term');

    expect(getAuthorityKnowledgeDropReason({
      sourceId: 'cdc',
      qualityTier: 'A',
      question: 'Reducing the risk of sudden infant death syndrome',
      answer: 'Guidance for caregivers.',
    })).toBe('death_related_term');
  });
});

import { inferAuthorityStages } from '../src/utils/authority-stage';
import { shouldFilterAuthoritySourceUrl } from '../src/utils/authority-source-url';
import {
  containsDeathRelatedTerms,
  evaluateAuthorityDocumentQuality,
  isHighRiskOrClickbaitTitle,
  isLikelyEnglishNavigationShell,
  isOffTopicGovPolicyTitle,
  shouldPublishDocument,
} from '../src/services/authority-adapters/base.adapter';

describe('authority content guards', () => {
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
    const stages = inferAuthorityStages({
      title: "Your Baby's Head",
      summary: 'In the first weeks after birth, your baby may still have molding of the skull.',
      contentText: 'This article explains normal newborn head shape changes.',
      audience: '婴幼儿家长',
      topic: 'development',
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
});

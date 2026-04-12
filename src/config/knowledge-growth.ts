import { listEnabledOfficialAuthoritySources, type AuthoritySourceConfig } from './authority-sources';

export type KnowledgeAppSurface =
  | 'home_feed'
  | 'knowledge_search'
  | 'calendar'
  | 'profile_archive'
  | 'weekly_report'
  | 'ai_followup';

export type KnowledgeLifecycleScope =
  | 'preparing'
  | 'pregnant_early'
  | 'pregnant_mid'
  | 'pregnant_late'
  | 'postpartum'
  | 'newborn'
  | 'infant_0_6'
  | 'infant_6_12'
  | 'toddler_1_3'
  | 'child_3_plus';

export interface KnowledgeGrowthTrack {
  id: string;
  title: string;
  appSurfaces: KnowledgeAppSurface[];
  lifecycleScopes: KnowledgeLifecycleScope[];
  audiences: string[];
  topics: string[];
  zhQueries: string[];
  enQueries: string[];
}

export interface KnowledgeGrowthSeed {
  id: string;
  trackId: string;
  trackTitle: string;
  sourceId: string;
  sourceOrg: string;
  locale: string;
  appSurfaces: KnowledgeAppSurface[];
  lifecycleScopes: KnowledgeLifecycleScope[];
  audiences: string[];
  topics: string[];
  zhQuery: string;
  enQuery: string;
}

export const KNOWLEDGE_GROWTH_TRACKS: KnowledgeGrowthTrack[] = [
  {
    id: 'preparing-checkups',
    title: '备孕检查与叶酸准备',
    appSurfaces: ['home_feed', 'calendar', 'knowledge_search', 'ai_followup'],
    lifecycleScopes: ['preparing'],
    audiences: ['备孕家庭'],
    topics: ['pregnancy', 'policy'],
    zhQueries: ['备孕 叶酸 孕前检查', '备孕 甲状腺 疫苗 口腔检查', '备孕 生活方式 调整'],
    enQueries: ['preconception care folic acid', 'pre pregnancy checkup guidance', 'preconception lifestyle counseling'],
  },
  {
    id: 'early-pregnancy-symptoms',
    title: '孕早期反应与异常信号',
    appSurfaces: ['home_feed', 'knowledge_search', 'weekly_report', 'ai_followup'],
    lifecycleScopes: ['pregnant_early'],
    audiences: ['孕妇'],
    topics: ['pregnancy', 'common-symptoms'],
    zhQueries: ['孕早期 早孕反应 腹痛 见红', '孕早期 建档 NT 检查', '孕早期 恶心 呕吐 脱水'],
    enQueries: ['first trimester nausea bleeding cramping', 'early pregnancy prenatal visit nt scan', 'first trimester hyperemesis guidance'],
  },
  {
    id: 'mid-pregnancy-checkups',
    title: '孕中期产检与控糖',
    appSurfaces: ['home_feed', 'calendar', 'knowledge_search', 'weekly_report'],
    lifecycleScopes: ['pregnant_mid'],
    audiences: ['孕妇'],
    topics: ['pregnancy', 'common-symptoms'],
    zhQueries: ['孕中期 四维 糖耐 胎动', '孕中期 贫血 补钙 体重增长', '孕中期 腰痛 水肿 睡眠'],
    enQueries: ['second trimester anatomy scan glucose screening', 'pregnancy anemia calcium weight gain', 'pregnancy back pain edema sleep'],
  },
  {
    id: 'late-pregnancy-labor',
    title: '孕晚期待产与分娩征兆',
    appSurfaces: ['home_feed', 'calendar', 'profile_archive', 'ai_followup'],
    lifecycleScopes: ['pregnant_late'],
    audiences: ['孕妇'],
    topics: ['pregnancy', 'common-symptoms'],
    zhQueries: ['孕晚期 宫缩 破水 见红', '待产包 入院准备 分娩征兆', '孕晚期 胎动减少 高血压 水肿'],
    enQueries: ['third trimester labor signs rupture of membranes', 'hospital bag birth preparation', 'decreased fetal movement pregnancy hypertension'],
  },
  {
    id: 'postpartum-recovery',
    title: '产后恢复与复查',
    appSurfaces: ['weekly_report', 'calendar', 'profile_archive', 'knowledge_search'],
    lifecycleScopes: ['postpartum'],
    audiences: ['产后妈妈'],
    topics: ['postpartum', 'common-symptoms', 'feeding'],
    zhQueries: ['产后 恶露 伤口 复查', '产后 情绪 睡眠 恢复', '产后 堵奶 乳腺炎'],
    enQueries: ['postpartum recovery bleeding incision follow up', 'postpartum mood sleep recovery', 'mastitis engorgement breastfeeding'],
  },
  {
    id: 'newborn-feeding-jaundice',
    title: '新生儿喂养与黄疸',
    appSurfaces: ['home_feed', 'knowledge_search', 'calendar', 'ai_followup'],
    lifecycleScopes: ['newborn'],
    audiences: ['新生儿家长'],
    topics: ['newborn', 'feeding', 'common-symptoms'],
    zhQueries: ['新生儿 黄疸 喂养 排便', '新生儿 体温 脱水 精神状态', '新生儿 母乳 配方奶 吃不饱'],
    enQueries: ['newborn jaundice feeding stool output', 'newborn dehydration temperature warning signs', 'newborn breastfeeding formula intake'],
  },
  {
    id: 'infant-sleep-feeding',
    title: '0-6 月喂养睡眠与发热湿疹',
    appSurfaces: ['home_feed', 'knowledge_search', 'weekly_report', 'ai_followup'],
    lifecycleScopes: ['infant_0_6'],
    audiences: ['婴幼儿家长'],
    topics: ['feeding', 'common-symptoms', 'vaccination', 'development'],
    zhQueries: ['婴儿 夜醒 奶量 拍嗝', '婴儿 发烧 湿疹 咳嗽', '0-6月 疫苗 儿保 发育'],
    enQueries: ['young infant sleep waking feeding burping', 'infant fever eczema cough guidance', '0 to 6 months vaccination well child visit'],
  },
  {
    id: 'infant-fever-triage',
    title: '婴幼儿发热分级与就医信号',
    appSurfaces: ['knowledge_search', 'ai_followup', 'weekly_report'],
    lifecycleScopes: ['newborn', 'infant_0_6', 'infant_6_12', 'toddler_1_3'],
    audiences: ['新生儿家长', '婴幼儿家长', '幼儿家长'],
    topics: ['common-symptoms', 'newborn'],
    zhQueries: ['宝宝 发烧 体温 退烧 就医', '新生儿 发热 拒奶 精神差', '幼儿 高烧 抽搐 呼吸急促'],
    enQueries: ['baby fever temperature when to seek care', 'newborn fever poor feeding warning signs', 'toddler high fever seizure breathing trouble'],
  },
  {
    id: 'infant-respiratory-symptoms',
    title: '咳嗽鼻塞呼吸道症状观察',
    appSurfaces: ['knowledge_search', 'ai_followup'],
    lifecycleScopes: ['newborn', 'infant_0_6', 'infant_6_12', 'toddler_1_3'],
    audiences: ['新生儿家长', '婴幼儿家长', '幼儿家长'],
    topics: ['common-symptoms', 'newborn'],
    zhQueries: ['宝宝 咳嗽 鼻塞 呼吸急促', '婴儿 喘鸣 呼吸困难 凹陷呼吸', '幼儿 感冒 咳嗽 夜里加重'],
    enQueries: ['baby cough congestion breathing fast', 'infant wheezing respiratory distress warning signs', 'toddler cold cough at night guidance'],
  },
  {
    id: 'infant-digestive-symptoms',
    title: '腹泻呕吐便秘与脱水观察',
    appSurfaces: ['knowledge_search', 'ai_followup', 'weekly_report'],
    lifecycleScopes: ['newborn', 'infant_0_6', 'infant_6_12', 'toddler_1_3'],
    audiences: ['新生儿家长', '婴幼儿家长', '幼儿家长'],
    topics: ['common-symptoms', 'feeding', 'newborn'],
    zhQueries: ['宝宝 腹泻 呕吐 脱水', '婴儿 便秘 便血 排便 困难', '新生儿 吐奶 腹胀 排便 少'],
    enQueries: ['baby diarrhea vomiting dehydration signs', 'infant constipation stool blood guidance', 'newborn spit up abdominal bloating stool output'],
  },
  {
    id: 'infant-skin-symptoms',
    title: '湿疹皮疹尿布疹护理',
    appSurfaces: ['knowledge_search', 'ai_followup'],
    lifecycleScopes: ['newborn', 'infant_0_6', 'infant_6_12', 'toddler_1_3'],
    audiences: ['新生儿家长', '婴幼儿家长', '幼儿家长'],
    topics: ['common-symptoms', 'newborn'],
    zhQueries: ['宝宝 湿疹 皮疹 护理', '尿布疹 红屁屁 破皮', '婴儿 过敏 皮肤瘙痒'],
    enQueries: ['baby eczema rash skin care', 'diaper rash severe skin breakdown', 'infant allergy itchy skin guidance'],
  },
  {
    id: 'postpartum-red-flags',
    title: '产后出血发热与乳房疼痛',
    appSurfaces: ['knowledge_search', 'ai_followup', 'weekly_report', 'profile_archive'],
    lifecycleScopes: ['postpartum'],
    audiences: ['产后妈妈'],
    topics: ['postpartum', 'common-symptoms', 'feeding'],
    zhQueries: ['产后 出血 恶露 发热', '产后 堵奶 乳房 红肿 疼痛', '产后 伤口 疼痛 感染 复查'],
    enQueries: ['postpartum bleeding lochia fever warning signs', 'mastitis breast engorgement pain postpartum', 'postpartum wound infection follow up'],
  },
  {
    id: 'infant-sleep-soothing',
    title: '夜醒哄睡与作息安抚',
    appSurfaces: ['knowledge_search', 'ai_followup', 'weekly_report'],
    lifecycleScopes: ['newborn', 'infant_0_6', 'infant_6_12', 'toddler_1_3'],
    audiences: ['新生儿家长', '婴幼儿家长', '幼儿家长'],
    topics: ['development', 'feeding', 'common-symptoms'],
    zhQueries: ['宝宝 夜醒 哄睡 安抚', '婴儿 睡眠倒退 作息 混乱', '幼儿 哭闹 入睡 困难'],
    enQueries: ['baby night waking soothing sleep routine', 'infant sleep regression routine guidance', 'toddler bedtime resistance settling'],
  },
  {
    id: 'complementary-feeding',
    title: '6-12 月辅食与过敏观察',
    appSurfaces: ['home_feed', 'knowledge_search', 'calendar', 'weekly_report'],
    lifecycleScopes: ['infant_6_12'],
    audiences: ['婴幼儿家长'],
    topics: ['feeding', 'development', 'common-symptoms'],
    zhQueries: ['6-12月 辅食 过敏 添加顺序', '婴儿 爬行 发育 体重', '婴儿 睡眠倒退 出牙'],
    enQueries: ['complementary feeding allergy introduction infant', 'infant crawling development growth', 'infant sleep regression teething'],
  },
  {
    id: 'toddler-behavior-language',
    title: '1-3 岁语言行为与如厕',
    appSurfaces: ['knowledge_search', 'weekly_report', 'profile_archive', 'ai_followup'],
    lifecycleScopes: ['toddler_1_3'],
    audiences: ['幼儿家长'],
    topics: ['development', 'common-symptoms', 'feeding'],
    zhQueries: ['1-3岁 语言发育 如厕训练', '幼儿 挑食 夜醒 情绪爆发', '幼儿 便秘 发热 咳嗽'],
    enQueries: ['toddler language development toilet training', 'toddler picky eating sleep tantrums', 'toddler constipation fever cough'],
  },
  {
    id: 'child-habits-adaptation',
    title: '3 岁以上行为习惯与入园适应',
    appSurfaces: ['knowledge_search', 'weekly_report', 'profile_archive'],
    lifecycleScopes: ['child_3_plus'],
    audiences: ['母婴家庭'],
    topics: ['development', 'common-symptoms'],
    zhQueries: ['儿童 入园适应 情绪行为', '儿童 睡眠 语言社交', '儿童 挑食 生长发育'],
    enQueries: ['preschool adaptation emotional behavior', 'child sleep language social development', 'child picky eating growth development'],
  },
  {
    id: 'vaccination-and-checkups',
    title: '疫苗与体检节点',
    appSurfaces: ['calendar', 'knowledge_search', 'home_feed'],
    lifecycleScopes: ['preparing', 'pregnant_early', 'pregnant_mid', 'pregnant_late', 'newborn', 'infant_0_6', 'infant_6_12', 'toddler_1_3', 'child_3_plus'],
    audiences: ['备孕家庭', '孕妇', '新生儿家长', '婴幼儿家长'],
    topics: ['vaccination', 'policy', 'newborn', 'pregnancy'],
    zhQueries: ['孕期 疫苗 流感 百白破', '儿童 疫苗 接种 反应', '儿保 体检 发育筛查'],
    enQueries: ['vaccination during pregnancy influenza tdap', 'childhood immunization reactions guidance', 'well child visit developmental screening'],
  },
];

function sourceSupportsTrack(source: AuthoritySourceConfig, track: KnowledgeGrowthTrack): boolean {
  return track.topics.some((topic) => source.topics.includes(topic))
    && track.audiences.some((audience) => source.audience.includes(audience) || audience === '母婴家庭');
}

export function buildKnowledgeGrowthSeeds(): KnowledgeGrowthSeed[] {
  const seeds: KnowledgeGrowthSeed[] = [];

  for (const track of KNOWLEDGE_GROWTH_TRACKS) {
    const matchedSources = listEnabledOfficialAuthoritySources().filter((source) => sourceSupportsTrack(source, track));
    for (const source of matchedSources) {
      const maxQueries = Math.max(track.zhQueries.length, track.enQueries.length);
      for (let index = 0; index < maxQueries; index += 1) {
        const zhQuery = track.zhQueries[index] || track.zhQueries[track.zhQueries.length - 1];
        const enQuery = track.enQueries[index] || track.enQueries[track.enQueries.length - 1];
        seeds.push({
          id: `${track.id}:${source.id}:${index + 1}`,
          trackId: track.id,
          trackTitle: track.title,
          sourceId: source.id,
          sourceOrg: source.org,
          locale: source.locale,
          appSurfaces: track.appSurfaces,
          lifecycleScopes: track.lifecycleScopes,
          audiences: track.audiences,
          topics: track.topics,
          zhQuery,
          enQuery,
        });
      }
    }
  }

  return seeds;
}

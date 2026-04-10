import dayjs from 'dayjs'
import type { User } from '../api/modules'
import {
  getCommunityStageLabel,
  type CommunityStageOnly,
} from '../../../shared/utils/community-stage'

export {
  COMMUNITY_STAGE_LABELS,
  COMMUNITY_STAGE_OPTIONS,
  getCommunityStageLabel,
  getUserCommunityStage,
  resolveCommunityStageFromPost,
  type CommunityStageKey,
  type CommunityStageOnly,
} from '../../../shared/utils/community-stage'

export type StageKind = 'preparing' | 'pregnant' | 'postpartum' | 'parenting'

export type LifecycleStageKey =
  | 'preparing'
  | 'pregnant_early'
  | 'pregnant_mid'
  | 'pregnant_late'
  | 'postpartum_newborn'
  | 'postpartum_recovery'
  | 'infant_0_6'
  | 'infant_6_12'
  | 'toddler_1_3'
  | 'child_3_plus'

export interface CalendarSuggestion {
  title: string
  description: string
  eventType: 'checkup' | 'vaccine' | 'reminder'
  windowLabel: string
  minOffsetDays: number
  maxOffsetDays: number
  reminderLabel: string
}

export interface StageSummary {
  kind: StageKind
  lifecycleKey: LifecycleStageKey
  lifecycleLabel: string
  profileStatusLabel: string
  communityStage: CommunityStageOnly
  communityStageLabel: string
  title: string
  subtitle: string
  focusTitle: string
  reminder: string
  readingTopic: string
  aiTipPreview: string
  aiTipFull: string
  actionLabel: string
  calendarTitle: string
  calendarSubtitle: string
  eventHeadline: string
  eventEmptyText: string
  suggestionTitle: string
  suggestionSubtitle: string
  knowledgeStages: string[]
  knowledgeKeywords: string[]
  statusTags: string[]
  calendarSuggestions: CalendarSuggestion[]
}

type ChildAge = {
  totalDays: number
  totalMonths: number
  years: number
  months: number
  days: number
}

function normalizePregnancyStatus(value?: string | number | null): StageKind {
  if (value === 2 || value === '2' || value === 'pregnant') return 'pregnant'
  if (value === 3 || value === '3' || value === 'postpartum') return 'postpartum'
  return 'preparing'
}

function calculatePregnancyProgress(dueDate?: string | null) {
  if (!dueDate) return null

  const now = dayjs()
  const target = dayjs(dueDate)
  const elapsedDays = Math.max(0, 280 - target.diff(now, 'day'))
  const week = Math.max(1, Math.floor(elapsedDays / 7) + 1)
  const day = (elapsedDays % 7) + 1

  return {
    elapsedDays,
    week,
    day,
  }
}

function calculateChildAge(babyBirthday?: string | null): ChildAge | null {
  if (!babyBirthday) return null

  const birth = dayjs(babyBirthday)
  const now = dayjs()
  const totalDays = Math.max(0, now.diff(birth, 'day'))
  const totalMonths = Math.max(0, now.diff(birth, 'month'))
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  const anchor = birth.add(totalMonths, 'month')
  const days = Math.max(0, now.diff(anchor, 'day'))

  return {
    totalDays,
    totalMonths,
    years,
    months,
    days,
  }
}

function formatChildTitle(age: ChildAge): string {
  if (age.totalMonths < 24) {
    return `宝宝 ${age.totalMonths} 月 ${age.days} 天`
  }

  if (age.totalMonths < 36) {
    return `宝宝 ${age.years} 岁 ${age.months} 月`
  }

  return `孩子 ${age.years} 岁 ${age.months} 月`
}

function getLifecycleCommunityStage(key: LifecycleStageKey): CommunityStageOnly {
  if (key === 'preparing') return 'preparing'
  if (key === 'pregnant_early') return 'pregnant_early'
  if (key === 'pregnant_mid') return 'pregnant_mid'
  if (key === 'pregnant_late') return 'pregnant_late'
  if (key === 'postpartum_newborn' || key === 'postpartum_recovery') return 'postpartum_recovery'
  return 'parenting'
}

function buildStageSummary(
  key: LifecycleStageKey,
  overrides: Partial<Omit<StageSummary, 'lifecycleKey' | 'communityStage' | 'communityStageLabel'>>,
): StageSummary {
  const communityStage = getLifecycleCommunityStage(key)

  const defaults: Omit<StageSummary, 'lifecycleKey' | 'communityStage' | 'communityStageLabel'> = {
    kind: key.startsWith('pregnant') ? 'pregnant' : key === 'preparing' ? 'preparing' : key.startsWith('postpartum') ? 'postpartum' : 'parenting',
    lifecycleLabel: '当前阶段',
    profileStatusLabel: '家庭阶段',
    title: '当前阶段',
    subtitle: '',
    focusTitle: '当前重点',
    reminder: '',
    readingTopic: '',
    aiTipPreview: '',
    aiTipFull: '',
    actionLabel: '查看成长日历',
    calendarTitle: '成长日历',
    calendarSubtitle: '把提醒、记录和阶段变化放在同一条时间线上。',
    eventHeadline: '近期安排',
    eventEmptyText: '先补一条重要提醒，让后续记录有起点。',
    suggestionTitle: '推荐安排',
    suggestionSubtitle: '根据当前阶段，先把最关键的 2-3 件事固定下来。',
    knowledgeStages: [],
    knowledgeKeywords: [],
    statusTags: [],
    calendarSuggestions: [],
  }

  return {
    lifecycleKey: key,
    communityStage,
    communityStageLabel: getCommunityStageLabel(communityStage),
    ...defaults,
    ...overrides,
  }
}

function createCalendarSuggestion(
  title: string,
  description: string,
  eventType: CalendarSuggestion['eventType'],
  windowLabel: string,
  minOffsetDays: number,
  maxOffsetDays: number,
): CalendarSuggestion {
  return {
    title,
    description,
    eventType,
    windowLabel,
    minOffsetDays,
    maxOffsetDays,
    reminderLabel: '默认前一晚 20:00 提醒',
  }
}

export function getStageSummary(user?: User | null): StageSummary {
  const pregnancy = calculatePregnancyProgress(user?.dueDate)
  const childAge = calculateChildAge(user?.babyBirthday)
  const kind = normalizePregnancyStatus(user?.pregnancyStatus)

  if (kind === 'pregnant' && pregnancy) {
    const lifecycleKey =
      pregnancy.week <= 13 ? 'pregnant_early' : pregnancy.week <= 27 ? 'pregnant_mid' : 'pregnant_late'

    const lifecycleLabel =
      lifecycleKey === 'pregnant_early' ? '孕早期' : lifecycleKey === 'pregnant_mid' ? '孕中期' : '孕晚期'

    return buildStageSummary(lifecycleKey, {
      kind: 'pregnant',
      lifecycleLabel,
      profileStatusLabel: '孕期中',
      title: `孕 ${pregnancy.week} 周 ${pregnancy.day} 天`,
      subtitle: '首页、日历和档案都会围绕你当前的阶段重点来组织，不再只看一个通用孕期面板。',
      focusTitle: '本周重点',
      reminder:
        lifecycleKey === 'pregnant_early'
          ? '优先稳住作息、叶酸与建档准备，把不适和检查结果持续记下来。'
          : lifecycleKey === 'pregnant_mid'
            ? '重点跟进胎动、体力、控糖和产检节奏，避免信息只停留在当下。'
            : '把待产准备、家人分工、宫缩观察和住院清单提前整理好。',
      readingTopic:
        lifecycleKey === 'pregnant_early'
          ? '孕早期必读：建档、营养补充与常见不适'
          : lifecycleKey === 'pregnant_mid'
            ? '孕中期必读：产检、控糖、睡眠与胎动观察'
            : '孕晚期必读：待产准备、分娩征兆与住院安排',
      aiTipPreview:
        lifecycleKey === 'pregnant_early'
          ? '适合先梳理建档、检查和早孕反应这三类问题。'
          : lifecycleKey === 'pregnant_mid'
            ? '适合集中问一次产检、营养和运动边界。'
            : '适合把待产、分娩征兆和家人协作一次问清。 ',
      aiTipFull:
        lifecycleKey === 'pregnant_early'
          ? '今天适合围绕建档、检查结果、孕反和营养补充做一次重点咨询。'
          : lifecycleKey === 'pregnant_mid'
            ? '今天适合围绕胎动、控糖、睡眠和体力恢复做一次重点咨询。'
            : '今天适合围绕待产包、住院流程、宫缩判断和产后衔接做一次重点咨询。',
      calendarTitle: '成长日历',
      calendarSubtitle: `${lifecycleLabel}更适合把产检、补剂、提醒和家人分工都收拢进来。`,
      eventHeadline: '近期安排',
      eventEmptyText:
        lifecycleKey === 'pregnant_early'
          ? '先加建档、NT 或补剂提醒，避免关键节点遗漏。'
          : lifecycleKey === 'pregnant_mid'
            ? '先加产检、控糖或胎动观察提醒。'
            : '先加待产包复查、产检或住院准备提醒。',
      suggestionTitle: '本阶段建议',
      suggestionSubtitle: '把最关键的检查、提醒和家庭协作动作先放进日历。',
      knowledgeStages: [lifecycleKey === 'pregnant_early' ? 'first-trimester' : lifecycleKey === 'pregnant_mid' ? 'second-trimester' : 'third-trimester'],
      knowledgeKeywords:
        lifecycleKey === 'pregnant_early'
          ? ['孕早期', '建档', '早孕反应']
          : lifecycleKey === 'pregnant_mid'
            ? ['孕中期', '胎动', '糖耐']
            : ['孕晚期', '待产', '分娩征兆'],
      statusTags: [
        lifecycleLabel,
        `当前孕周 ${pregnancy.week} 周`,
        lifecycleKey === 'pregnant_late' ? '待产准备中' : '阶段重点持续追踪',
      ],
      calendarSuggestions:
        lifecycleKey === 'pregnant_early'
          ? [
              createCalendarSuggestion('建档或首诊提醒', '把第一次系统产检放进日历。', 'checkup', '建议 1-10 天内完成', 1, 10),
              createCalendarSuggestion('补剂与作息复盘', '用固定提醒追踪叶酸、休息和饮水。', 'reminder', '建议未来 1 周内启动', 0, 7),
              createCalendarSuggestion('异常症状记录', '出现见红、腹痛等情况时更容易快速回看。', 'reminder', '建议 3 天内建立观察点', 0, 3),
            ]
          : lifecycleKey === 'pregnant_mid'
            ? [
                createCalendarSuggestion('本月产检安排', '把四维、糖耐或复诊先排好。', 'checkup', '建议 3-14 天内锁定', 3, 14),
                createCalendarSuggestion('胎动与体重记录', '用同一时间点记录变化趋势。', 'reminder', '建议未来 7 天内开始', 0, 7),
                createCalendarSuggestion('营养与运动计划', '避免只凭感觉执行。', 'reminder', '建议 1-10 天内排入', 1, 10),
              ]
            : [
                createCalendarSuggestion('待产包复查', '把住院证件、物品和家属分工都过一遍。', 'reminder', '建议 1-5 天内完成', 0, 5),
                createCalendarSuggestion('临近产检安排', '提前锁定复查与分娩前检查。', 'checkup', '建议 3-12 天内安排', 3, 12),
                createCalendarSuggestion('分娩征兆观察', '把宫缩、见红、破水的判断写进提醒。', 'reminder', '建议未来 48 小时内建立', 0, 2),
              ],
    })
  }

  if (kind === 'postpartum' && childAge) {
    if (childAge.totalDays <= 28) {
      return buildStageSummary('postpartum_newborn', {
        kind: 'postpartum',
        lifecycleLabel: '月子与新生儿期',
        profileStatusLabel: '育儿中',
        title: `月子第 ${childAge.totalDays + 1} 天`,
        subtitle: '这时不是只管恢复，也不是只盯宝宝，App 会同时看妈妈恢复与新生儿照护。',
        focusTitle: '今天先稳住',
        reminder: '优先记录喂养、黄疸、排便、体温、伤口和睡眠，后续判断才有依据。',
        readingTopic: '新生儿必读：喂养、黄疸、睡眠与妈妈恢复',
        aiTipPreview: '适合把喂养、黄疸、睡眠和妈妈恢复一起梳理。 ',
        aiTipFull: '今天适合把喂养频次、黄疸观察、大小便、恶露和伤口恢复放到同一次咨询里。',
        calendarTitle: '成长日历',
        calendarSubtitle: '月子与新生儿期更适合用日历串起喂养观察、复诊和家人协作。',
        eventHeadline: '近期母婴安排',
        eventEmptyText: '先补喂养观察、黄疸复诊或产后复查提醒。',
        suggestionTitle: '母婴关键提醒',
        suggestionSubtitle: '把最容易漏掉的照护与复诊动作先固定下来。',
        knowledgeStages: ['0-6-months'],
        knowledgeKeywords: ['新生儿', '月子', '黄疸', '喂养'],
        statusTags: ['月子期', '新生儿照护', `宝宝 ${childAge.totalDays} 天`],
        calendarSuggestions: [
          createCalendarSuggestion('喂养与排便观察', '固定时间记录吃奶、排便和精神状态。', 'reminder', '建议未来 48 小时内开始', 0, 2),
          createCalendarSuggestion('黄疸或复诊提醒', '把出院后复查与异常观察放进日历。', 'checkup', '建议 1-5 天内安排', 1, 5),
          createCalendarSuggestion('产后恢复观察', '恶露、伤口、情绪和睡眠要同步记录。', 'reminder', '建议 3 天内建立', 0, 3),
        ],
      })
    }

    if (childAge.totalDays <= 42) {
      return buildStageSummary('postpartum_recovery', {
        kind: 'postpartum',
        lifecycleLabel: '产后恢复期',
        profileStatusLabel: '育儿中',
        title: `产后 ${childAge.totalDays} 天`,
        subtitle: '重点从急性恢复慢慢过渡到家庭节奏重建，App 更应该帮你看连续性而不是单点。 ',
        focusTitle: '恢复重点',
        reminder: '继续盯住伤口、恶露、睡眠、喂养与情绪状态，不要只看宝宝不看自己。',
        readingTopic: '产后恢复必读：复查、喂养调整与情绪支持',
        aiTipPreview: '适合把恢复、喂养和夜间节奏一起问。 ',
        aiTipFull: '今天适合围绕产后复查、恶露变化、喂养调整和夜间节奏做一次重点咨询。',
        calendarTitle: '成长日历',
        calendarSubtitle: '先把复查、喂养和作息恢复排成一条清晰时间线。',
        eventHeadline: '近期恢复安排',
        eventEmptyText: '先补产后复查、喂养复盘或家人协作提醒。',
        suggestionTitle: '恢复建议',
        suggestionSubtitle: '把妈妈恢复和宝宝照护都放进同一套节奏里。',
        knowledgeStages: ['0-6-months'],
        knowledgeKeywords: ['产后恢复', '喂养', '开奶', '夜醒'],
        statusTags: ['产后恢复', `宝宝 ${childAge.totalDays} 天`, '家庭节奏重建'],
        calendarSuggestions: [
          createCalendarSuggestion('产后复查安排', '提前锁定复诊、盆底或伤口相关检查。', 'checkup', '建议 3-14 天内安排', 3, 14),
          createCalendarSuggestion('喂养复盘提醒', '观察奶量、胀奶、堵奶和夜间节奏。', 'reminder', '建议未来 7 天内固定', 0, 7),
          createCalendarSuggestion('情绪与睡眠观察', '把压力变化也纳入连续记录。', 'reminder', '建议 5 天内建立观察', 0, 5),
        ],
      })
    }

    if (childAge.totalMonths < 6) {
      return buildStageSummary('infant_0_6', {
        kind: 'parenting',
        lifecycleLabel: '0-6 月',
        profileStatusLabel: '育儿中',
        title: formatChildTitle(childAge),
        subtitle: '核心不是多功能，而是把喂养、睡眠、疫苗和异常信号收成一个可回看的系统。',
        focusTitle: '当前重点',
        reminder: '优先追踪吃奶、夜醒、体重、皮肤和精神状态，异常时能马上回看趋势。',
        readingTopic: '0-6 月必读：喂养、睡眠、湿疹、发热与疫苗',
        aiTipPreview: '适合把喂养、睡眠和异常症状集中梳理。 ',
        aiTipFull: '今天适合围绕奶量、拍嗝、夜醒、湿疹、发热和疫苗安排做一次重点咨询。',
        calendarTitle: '成长日历',
        calendarSubtitle: '0-6 月更适合用日历串起疫苗、体检、喂养复盘和异常观察。',
        eventHeadline: '近期育儿安排',
        eventEmptyText: '先补疫苗、儿保或喂养复盘提醒。',
        suggestionTitle: '常用提醒模板',
        suggestionSubtitle: '把最常重复的观察点交给日历，而不是靠记忆。',
        knowledgeStages: ['0-6-months'],
        knowledgeKeywords: ['0-6月', '喂养', '夜醒', '疫苗'],
        statusTags: ['0-6 月照护', `宝宝 ${childAge.totalMonths} 月`, '喂养睡眠优先'],
        calendarSuggestions: [
          createCalendarSuggestion('儿保或体检提醒', '把近期复查与生长评估固定下来。', 'checkup', '建议 3-21 天内排入', 3, 21),
          createCalendarSuggestion('疫苗接种安排', '避免接种节点靠临时回忆。', 'vaccine', '建议 3-21 天内锁定', 3, 21),
          createCalendarSuggestion('喂养与睡眠复盘', '每周留一个时间点专门回看节奏。', 'reminder', '建议未来 7 天内设置', 0, 7),
        ],
      })
    }

    if (childAge.totalMonths < 12) {
      return buildStageSummary('infant_6_12', {
        kind: 'parenting',
        lifecycleLabel: '6-12 月',
        profileStatusLabel: '育儿中',
        title: formatChildTitle(childAge),
        subtitle: '这个阶段开始从纯照护转向节律建立，辅食、作息和发育里程碑要一起看。',
        focusTitle: '本阶段重点',
        reminder: '辅食添加、作息变化、翻身爬行和疫苗节点最好都留有记录。',
        readingTopic: '6-12 月必读：辅食、睡眠倒退、发育与疫苗',
        aiTipPreview: '适合把辅食、睡眠和发育问题集中整理。 ',
        aiTipFull: '今天适合围绕辅食添加、过敏观察、睡眠倒退、爬行与疫苗安排做一次重点咨询。',
        calendarTitle: '成长日历',
        calendarSubtitle: '6-12 月更适合把辅食、儿保、疫苗和作息变化集中管理。',
        eventHeadline: '近期成长安排',
        eventEmptyText: '先补辅食进度、儿保或疫苗提醒。',
        suggestionTitle: '成长建议',
        suggestionSubtitle: '把喂养、作息和发育里程碑都做成有节奏的记录。',
        knowledgeStages: ['6-12-months'],
        knowledgeKeywords: ['6-12月', '辅食', '睡眠倒退', '爬行'],
        statusTags: ['6-12 月成长', '辅食与作息', '里程碑观察'],
        calendarSuggestions: [
          createCalendarSuggestion('辅食添加计划', '用事件提醒安排新食材和过敏观察。', 'reminder', '建议 1-14 天内启动', 1, 14),
          createCalendarSuggestion('儿保与疫苗安排', '把检查和接种固定下来。', 'checkup', '建议 3-21 天内排好', 3, 21),
          createCalendarSuggestion('睡眠复盘提醒', '观察夜醒、白天小睡和作息转换。', 'reminder', '建议 10 天内固定', 0, 10),
        ],
      })
    }

    if (childAge.totalMonths < 36) {
      return buildStageSummary('toddler_1_3', {
        kind: 'parenting',
        lifecycleLabel: '1-3 岁',
        profileStatusLabel: '育儿中',
        title: formatChildTitle(childAge),
        subtitle: '核心重心会从生理照护转到语言、行为、睡眠、饮食和家庭规则建立。',
        focusTitle: '发展重点',
        reminder: '优先跟踪语言、如厕、情绪、吃饭、睡眠和疫苗，不要只在出问题时才记录。',
        readingTopic: '1-3 岁必读：语言发展、如厕、情绪与饮食习惯',
        aiTipPreview: '适合把吃饭、睡眠、语言和情绪问题一起拆解。 ',
        aiTipFull: '今天适合围绕语言发展、如厕训练、情绪爆发、挑食和睡眠边界做一次重点咨询。',
        calendarTitle: '成长日历',
        calendarSubtitle: '1-3 岁更适合把体检、疫苗、如厕、作息和发育里程碑放在同一张日历里。',
        eventHeadline: '近期家庭安排',
        eventEmptyText: '先补体检、疫苗、如厕训练或语言观察提醒。',
        suggestionTitle: '家庭节律建议',
        suggestionSubtitle: '把长期要做的事固定下来，比临时补救更有效。',
        knowledgeStages: ['1-3-years'],
        knowledgeKeywords: ['1-3岁', '语言发育', '如厕', '挑食'],
        statusTags: ['1-3 岁发展', '行为与语言', '家庭规则建立'],
        calendarSuggestions: [
          createCalendarSuggestion('体检或疫苗安排', '把线下检查和补种固定下来。', 'checkup', '建议 7-30 天内安排', 7, 30),
          createCalendarSuggestion('如厕训练复盘', '用重复提醒跟踪节奏和反馈。', 'reminder', '建议未来 14 天内固定', 0, 14),
          createCalendarSuggestion('语言与行为观察', '记录说话、互动、情绪和专注变化。', 'reminder', '建议未来 14 天内开始', 0, 14),
        ],
      })
    }

    return buildStageSummary('child_3_plus', {
      kind: 'parenting',
      lifecycleLabel: '3 岁以上',
      profileStatusLabel: '育儿中',
      title: formatChildTitle(childAge),
      subtitle: '进入 3 岁后，App 不该停在婴幼儿视角，而要转向行为、语言、社交、习惯和入园适应。',
      focusTitle: '长期关注',
      reminder: '优先看语言表达、情绪调节、睡眠、饮食、社交和年度体检，把长期趋势沉淀下来。',
      readingTopic: '3 岁以上必读：行为习惯、语言社交、睡眠与入园适应',
      aiTipPreview: '适合把行为、语言、睡眠和入园适应类问题集中整理。 ',
      aiTipFull: '今天适合围绕语言表达、情绪管理、作息边界、挑食和入园适应做一次重点咨询。',
      calendarTitle: '成长日历',
      calendarSubtitle: '3 岁以上更适合把体检、疫苗、行为观察和家庭习惯养成放进长期时间线。',
      eventHeadline: '近期家庭安排',
      eventEmptyText: '先补年度体检、疫苗、语言观察或入园准备提醒。',
      suggestionTitle: '长期陪伴建议',
      suggestionSubtitle: '把年度检查、行为观察和家庭习惯养成放进连续记录。',
      knowledgeStages: [],
      knowledgeKeywords: ['儿童', '语言发展', '情绪行为', '睡眠习惯', '入园适应'],
      statusTags: ['3 岁以上', '行为与语言发展', '长期家庭陪伴'],
      calendarSuggestions: [
        createCalendarSuggestion('年度体检安排', '把年度体检、牙齿或视力检查先排上。', 'checkup', '建议 15-45 天内安排', 15, 45),
        createCalendarSuggestion('语言与社交观察', '记录表达、互动和情绪调节的变化。', 'reminder', '建议未来 21 天内开始', 0, 21),
        createCalendarSuggestion('入园或作息准备', '把家庭规则、作息和环境适应做成节律。', 'reminder', '建议 7-21 天内排入', 7, 21),
      ],
    })
  }

  if (kind === 'postpartum') {
    return buildStageSummary('postpartum_recovery', {
      kind: 'postpartum',
      lifecycleLabel: '产后恢复期',
      profileStatusLabel: '育儿中',
      title: '产后阶段',
      subtitle: '先用恢复逻辑组织首页和日历，等补齐宝宝生日后再自动切到更细阶段。',
      focusTitle: '恢复重点',
      reminder: '优先记录复查、伤口、睡眠、情绪和喂养节奏。',
      readingTopic: '产后恢复必读：复查、喂养与情绪支持',
      aiTipPreview: '先把恢复和喂养问题梳理清楚。 ',
      aiTipFull: '今天适合围绕产后复查、喂养、睡眠和恢复节奏做一次重点咨询。',
      calendarTitle: '成长日历',
      calendarSubtitle: '先把复查、恢复和喂养观察固定下来。',
      eventHeadline: '近期恢复安排',
      eventEmptyText: '先补一条复查或恢复提醒。',
      suggestionTitle: '恢复建议',
      suggestionSubtitle: '把最关键的恢复节点固定进日历。',
      knowledgeStages: ['0-6-months'],
      knowledgeKeywords: ['产后恢复', '喂养'],
      statusTags: ['产后恢复', '等待补充宝宝生日'],
      calendarSuggestions: [
        createCalendarSuggestion('产后复查安排', '固定产后关键复查节点。', 'checkup', '建议 3-14 天内安排', 3, 14),
        createCalendarSuggestion('恢复观察提醒', '让伤口、恶露和睡眠都有连续记录。', 'reminder', '建议未来 7 天内建立', 0, 7),
      ],
    })
  }

  return buildStageSummary('preparing', {
    kind: 'preparing',
    lifecycleLabel: '备孕期',
    profileStatusLabel: '备孕中',
    title: '备孕阶段',
    subtitle: 'App 的起点不该是怀孕后，而应该从备孕节律、检查和家庭准备就开始持续陪伴。',
    focusTitle: '本周建议',
    reminder: '先稳定作息、补充叶酸、完善孕前检查和家庭分工准备。',
    readingTopic: '备孕必读：检查、营养、作息与受孕准备',
    aiTipPreview: '适合先梳理检查、叶酸、作息和受孕准备。 ',
    aiTipFull: '今天适合围绕孕前检查、叶酸补充、作息调整和受孕准备做一次重点咨询。',
    calendarTitle: '成长日历',
    calendarSubtitle: '备孕阶段也要有自己的时间线，把检查、补剂和生活方式调整都收进来。',
    eventHeadline: '近期备孕安排',
    eventEmptyText: '先加一个检查、补剂或作息提醒。',
    suggestionTitle: '备孕建议',
    suggestionSubtitle: '把真正影响后续体验的动作，先固定进本周日历。',
    knowledgeStages: ['preparation'],
    knowledgeKeywords: ['备孕', '叶酸', '孕前检查'],
    statusTags: ['备孕节律', '检查与营养', '为下阶段打底'],
    calendarSuggestions: [
      createCalendarSuggestion('孕前检查安排', '先把体检、口腔或专科检查排清楚。', 'checkup', '建议 3-14 天内完成', 3, 14),
      createCalendarSuggestion('叶酸与作息提醒', '让关键基础动作变成稳定习惯。', 'reminder', '建议未来 21 天内固定', 0, 21),
      createCalendarSuggestion('家庭准备清单', '把预算、分工和风险点提前整理。', 'reminder', '建议 3-14 天内排入', 3, 14),
    ],
  })
}

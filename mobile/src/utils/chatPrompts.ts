import type { LifecycleStageKey } from './stage'

export type CaregiverRoleView = 'default' | 'father'

export const QUICK_QUESTION_MAP: Record<LifecycleStageKey, string[]> = {
  preparing: [
    '备孕阶段这周最该先做的三件事是什么？',
    '孕前检查一般先安排哪些项目？',
    '叶酸、作息和饮食怎么调整更稳妥？',
    '能帮我列一个 7 天备孕准备清单吗？',
  ],
  pregnant_early: [
    '孕早期这周最该注意的三件事是什么？',
    '建档前我需要先准备什么？',
    '早孕反应和饮食怎么安排更稳妥？',
    '能帮我拆解一次产检前准备吗？',
  ],
  pregnant_mid: [
    '孕中期这周最该注意的三件事是什么？',
    '胎动、糖耐和睡眠要先抓哪一项？',
    '孕中期营养补充怎么安排更稳妥？',
    '可以帮我排一个产检和日常节奏吗？',
  ],
  pregnant_late: [
    '孕晚期这周最该注意的三件事是什么？',
    '待产包和住院前准备怎么拆解？',
    '宫缩、见红、破水分别怎么判断？',
    '可以帮我列一个分娩前家庭协作清单吗？',
  ],
  postpartum_newborn: [
    '月子和新生儿阶段今天先盯哪三件事？',
    '黄疸、吃奶和排便怎么一起观察？',
    '妈妈恢复和宝宝照护怎么同步安排？',
    '能帮我梳理一个新生儿观察清单吗？',
  ],
  postpartum_recovery: [
    '产后恢复期这周最该注意的三件事是什么？',
    '恶露、伤口、喂养和睡眠要怎么排序？',
    '产后复查前要先准备什么？',
    '可以帮我排一个恢复期家庭节奏吗？',
  ],
  infant_0_6: [
    '0-6月宝宝这周最该关注什么？',
    '反复夜醒一般先排查什么？',
    '喂养、湿疹和疫苗怎么一起安排？',
    '能帮我列一个本周喂养观察清单吗？',
  ],
  infant_6_12: [
    '6-12月宝宝这周最该关注什么？',
    '辅食添加顺序怎么安排更稳妥？',
    '睡眠倒退一般先排查什么？',
    '可以帮我列一个辅食和作息计划吗？',
  ],
  toddler_1_3: [
    '1-3岁孩子这周最该关注什么？',
    '如厕训练卡住了先排查什么？',
    '挑食、睡眠和情绪问题怎么一起看？',
    '能帮我做一个语言发展观察清单吗？',
  ],
  child_3_plus: [
    '3岁以上孩子这周最该关注什么？',
    '入园适应一般先看哪些信号？',
    '语言、情绪和睡眠边界怎么一起梳理？',
    '能帮我列一个行为观察清单吗？',
  ],
}

const FATHER_QUICK_QUESTION_MAP: Record<LifecycleStageKey, string[]> = {
  preparing: [
    '备孕阶段这周我能先配合做哪三件事？',
    '孕前检查里哪些项目需要我一起准备？',
    '叶酸、作息和饮食调整里我能具体做什么？',
    '能帮我列一个备孕期伴侣协作清单吗？',
  ],
  pregnant_early: [
    '孕早期这周我能帮她分担哪三件事？',
    '建档前哪些资料和安排需要我提前准备？',
    '她早孕反应明显时，我应该先怎么照顾？',
    '能帮我拆解一次产检陪同准备吗？',
  ],
  pregnant_mid: [
    '孕中期这周我能帮她分担哪三件事？',
    '糖耐、胎动和产检我分别要帮忙盯什么？',
    '孕中期如果看不懂检查结果，我应该先问医生哪些问题？',
    '能帮我列一个本周爸爸协作清单吗？',
  ],
  pregnant_late: [
    '孕晚期这周我能帮她分担哪三件事？',
    '待产包、住院证件和路线我应该怎么准备？',
    '宫缩、见红、破水出现时我该怎么判断和行动？',
    '能帮我列一个分娩前家庭协作清单吗？',
  ],
  postpartum_newborn: [
    '月子和新生儿阶段今天我先帮哪三件事？',
    '黄疸、吃奶和排便我能怎么一起观察？',
    '她恢复和宝宝照护之间，我应该怎么分工？',
    '能帮我梳理一个新手爸爸观察清单吗？',
  ],
  postpartum_recovery: [
    '产后恢复期这周我能帮她分担哪三件事？',
    '恶露、伤口、喂养和睡眠我应该先盯什么？',
    '产后复查前我可以帮忙准备哪些信息？',
    '能帮我排一个恢复期家庭协作节奏吗？',
  ],
  infant_0_6: [
    '0-6月宝宝这周我最该关注什么？',
    '宝宝反复夜醒时我应该先排查什么？',
    '喂养、湿疹和疫苗我能怎么协助安排？',
    '能帮我列一个本周爸爸照护清单吗？',
  ],
  infant_6_12: [
    '6-12月宝宝这周我最该关注什么？',
    '辅食添加时我可以负责哪些准备？',
    '宝宝睡眠倒退时我应该先排查什么？',
    '能帮我列一个辅食和作息协作计划吗？',
  ],
  toddler_1_3: [
    '1-3岁孩子这周我最该关注什么？',
    '如厕训练卡住了我应该先配合什么？',
    '挑食、睡眠和情绪问题我能怎么协助处理？',
    '能帮我做一个爸爸视角语言发展观察清单吗？',
  ],
  child_3_plus: [
    '3岁以上孩子这周我最该关注什么？',
    '入园适应时我应该先看哪些信号？',
    '语言、情绪和睡眠边界我能怎么一起配合？',
    '能帮我列一个爸爸视角行为观察清单吗？',
  ],
}

export function resolveCaregiverRoleView(caregiverRole?: string | number | null): CaregiverRoleView {
  if (caregiverRole === 2 || caregiverRole === '2') {
    return 'father'
  }

  if (typeof caregiverRole === 'string') {
    const normalized = caregiverRole.trim().toLowerCase()
    if (normalized === 'father' || normalized === 'dad' || normalized === '爸爸') {
      return 'father'
    }
  }

  return 'default'
}

export function getQuickQuestions(stageKey: LifecycleStageKey, caregiverRole?: string | number | null) {
  return resolveCaregiverRoleView(caregiverRole) === 'father'
    ? FATHER_QUICK_QUESTION_MAP[stageKey]
    : QUICK_QUESTION_MAP[stageKey]
}

function getDateKey(date?: Date | string): string {
  if (typeof date === 'string' && date.trim()) {
    return date.trim().slice(0, 10)
  }

  const target = date instanceof Date ? date : new Date()
  const year = target.getFullYear()
  const month = String(target.getMonth() + 1).padStart(2, '0')
  const day = String(target.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDailyQuestionIndex(dateKey: string, count: number): number {
  const day = Number(dateKey.slice(-2))
  if (Number.isFinite(day) && day > 0) {
    return day % count
  }

  return 0
}

export function getDailyQuestion(
  stageKey: LifecycleStageKey,
  options?: {
    caregiverRole?: string | number | null
    date?: Date | string
  },
) {
  const questions = getQuickQuestions(stageKey, options?.caregiverRole)
  return questions[getDailyQuestionIndex(getDateKey(options?.date), questions.length)] || questions[0]
}

export function getSuggestedQuestion(stageKey: LifecycleStageKey, caregiverRole?: string | number | null) {
  return getQuickQuestions(stageKey, caregiverRole)[0]
}

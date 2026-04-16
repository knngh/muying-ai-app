export type KnowledgeStageKey =
  | 'preparation'
  | 'first-trimester'
  | 'second-trimester'
  | 'third-trimester'
  | 'postpartum'
  | 'newborn'
  | '0-6-months'
  | '6-12-months'
  | '1-3-years'
  | '3-years-plus'

type KnowledgeStageConfig = {
  label: string
  queryStages: KnowledgeStageKey[]
  fallbackKeyword: string
}

const KNOWLEDGE_STAGE_CONFIG: Record<KnowledgeStageKey, KnowledgeStageConfig> = {
  preparation: {
    label: '备孕期',
    queryStages: ['preparation'],
    fallbackKeyword: '备孕 叶酸 孕前检查',
  },
  'first-trimester': {
    label: '孕早期',
    queryStages: ['first-trimester'],
    fallbackKeyword: '孕早期 建档 早孕反应',
  },
  'second-trimester': {
    label: '孕中期',
    queryStages: ['second-trimester'],
    fallbackKeyword: '孕中期 胎动 糖耐',
  },
  'third-trimester': {
    label: '孕晚期',
    queryStages: ['third-trimester'],
    fallbackKeyword: '孕晚期 待产 分娩征兆',
  },
  postpartum: {
    label: '产后恢复',
    queryStages: ['postpartum', 'newborn', '0-6-months'],
    fallbackKeyword: '产后恢复 恶露 伤口 复查 喂养',
  },
  newborn: {
    label: '月子/新生儿',
    queryStages: ['newborn', 'postpartum', '0-6-months'],
    fallbackKeyword: '新生儿 黄疸 喂养 排便 脐带',
  },
  '0-6-months': {
    label: '0-6月',
    queryStages: ['0-6-months', 'newborn'],
    fallbackKeyword: '新生儿 喂养 夜醒 疫苗',
  },
  '6-12-months': {
    label: '6-12月',
    queryStages: ['6-12-months', '0-6-months'],
    fallbackKeyword: '辅食 睡眠倒退 发育 疫苗',
  },
  '1-3-years': {
    label: '1-3岁',
    queryStages: ['1-3-years', '3-years-plus'],
    fallbackKeyword: '语言发展 如厕 情绪 挑食',
  },
  '3-years-plus': {
    label: '3岁+',
    queryStages: ['3-years-plus', '1-3-years'],
    fallbackKeyword: '儿童 语言 情绪行为 睡眠 习惯 入园',
  },
}

export const KNOWLEDGE_STAGE_OPTIONS = [
  { label: '全部阶段', value: null },
  ...Object.entries(KNOWLEDGE_STAGE_CONFIG).map(([value, config]) => ({
    label: config.label,
    value,
  })),
]

function uniqStages(stages: string[]) {
  const seen = new Set<string>()
  return stages.filter((stage) => {
    if (!stage || seen.has(stage)) {
      return false
    }
    seen.add(stage)
    return true
  })
}

export function getKnowledgeStageCluster(stage?: string | null): string[] {
  if (!stage) return []

  const config = KNOWLEDGE_STAGE_CONFIG[stage as KnowledgeStageKey]
  if (!config) {
    return [stage]
  }

  return [...config.queryStages]
}

export function getKnowledgeStageQuery(stage?: string | null): string | undefined {
  const cluster = getKnowledgeStageCluster(stage)
  return cluster.length > 0 ? cluster.join(',') : undefined
}

export function getKnowledgeStageQueryFromStages(stages?: string[]): string | undefined {
  if (!Array.isArray(stages) || stages.length === 0) {
    return undefined
  }

  const expanded = uniqStages(
    stages.flatMap((stage) => getKnowledgeStageCluster(stage)),
  )

  return expanded.length > 0 ? expanded.join(',') : undefined
}

export function getKnowledgeFallbackKeyword(stage?: string | null): string | undefined {
  if (!stage) return undefined
  return KNOWLEDGE_STAGE_CONFIG[stage as KnowledgeStageKey]?.fallbackKeyword
}

export function getKnowledgeStagePriorityMap(stage?: string | null): Map<string, number> {
  return new Map(getKnowledgeStageCluster(stage).map((item, index) => [item, index]))
}

export function getKnowledgeStagePriorityMapFromStages(stages?: string[]): Map<string, number> {
  if (!Array.isArray(stages) || stages.length === 0) {
    return new Map()
  }

  const expanded = uniqStages(
    stages.flatMap((stage) => getKnowledgeStageCluster(stage)),
  )

  return new Map(expanded.map((stage, index) => [stage, index]))
}

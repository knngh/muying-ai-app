import { currentToolPeriod } from '../utils/tool-period'

export type ToolId =
  | 'calendar'
  | 'contractions'
  | 'movement'
  | 'weight'
  | 'care'
  | 'growth'
  | 'packing'
  | 'vaccines'
  | 'foods'
  | 'reports'
  | 'poster'
  | 'diary'
  | 'album'
  | 'expenses'
  | 'names'

export type ToolStage = 'preparing' | 'early' | 'middle' | 'late' | 'newborn' | 'feeding'
export type ToolGroup = 'pregnancy' | 'planning' | 'baby' | 'memory'
export type ToolTone = 'rose' | 'orange' | 'green' | 'lilac'
export type ToolStatus = 'ready' | 'preview' | 'planned'

export interface ToolDefinition {
  id: ToolId
  title: string
  kicker: string
  description: string
  icon: string
  group: ToolGroup
  tone: ToolTone
  status: ToolStatus
  stages: ToolStage[]
  primaryAction: string
  helper: string
}

export const TOOL_GROUPS: Array<{ id: ToolGroup; title: string; description: string }> = [
  { id: 'pregnancy', title: '孕期记录', description: '把关键变化和下一步安排留在同一条时间线上。' },
  { id: 'planning', title: '待产准备', description: '按出生阶段准备清单、接种和家庭讨论。' },
  { id: 'baby', title: '宝宝照护', description: '从出生后的喂养、睡眠到生长和辅食。' },
  { id: 'memory', title: '生活纪念', description: '保存照片、文字和家庭共同的阶段记录。' },
]

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'calendar', title: '孕育日历', kicker: '记录底座', description: '按孕周或成长阶段查看提醒、待办和已经留下的记录。', icon: '日', group: 'pregnancy', tone: 'orange', status: 'ready',
    stages: ['preparing', 'early', 'middle', 'late', 'newborn', 'feeding'], primaryAction: '打开日历', helper: '原有日历继续作为所有记录的入口。',
  },
  {
    id: 'contractions', title: '宫缩计时', kicker: '孕晚期工具', description: '记录每次宫缩的起止与持续时间。', icon: '时', group: 'pregnancy', tone: 'rose', status: 'planned',
    stages: ['late'], primaryAction: '开始记录', helper: '只做计时，不判断是否临产。',
  },
  {
    id: 'movement', title: '胎动计数', kicker: '按医嘱记录', description: '点按计数，保存一次胎动记录。', icon: '动', group: 'pregnancy', tone: 'rose', status: 'planned',
    stages: ['middle', 'late'], primaryAction: '开始计数', helper: '按医嘱记录，如有疑虑请咨询医生。',
  },
  {
    id: 'weight', title: '孕期体重', kicker: '趋势记录', description: '保存体重测量，回看个人变化。', icon: '重', group: 'pregnancy', tone: 'green', status: 'planned',
    stages: ['early', 'middle', 'late'], primaryAction: '记录体重', helper: '参考区间功能仍在准备中。',
  },
  {
    id: 'care', title: '喂养三件套', kicker: '新生儿照护', description: '快速记录喂奶、尿布和睡眠事项。', icon: '护', group: 'baby', tone: 'green', status: 'planned',
    stages: ['newborn', 'feeding'], primaryAction: '记一笔照护', helper: '计时和每日摘要仍在完善中。',
  },
  {
    id: 'growth', title: '宝宝生长', kicker: '成长曲线', description: '记录身高、体重和头围数值。', icon: '长', group: 'baby', tone: 'green', status: 'planned',
    stages: ['newborn', 'feeding'], primaryAction: '记录测量', helper: 'WHO 参考曲线仍在准备中。',
  },
  {
    id: 'packing', title: '待产包清单', kicker: '家庭协作', description: '妈妈、宝宝、证件，逐项准备。', icon: '包', group: 'planning', tone: 'orange', status: 'planned',
    stages: ['middle', 'late'], primaryAction: '查看清单', helper: '目前支持基础勾选，家庭认领尚未开放。',
  },
  {
    id: 'vaccines', title: '疫苗时间表', kicker: '按出生日期', description: '记录疫苗名称、日期与接种状态。', icon: '苗', group: 'planning', tone: 'green', status: 'planned',
    stages: ['newborn', 'feeding'], primaryAction: '查看计划', helper: '自动时间表尚未开放，安排以接种门诊为准。',
  },
  {
    id: 'foods', title: '辅食添加', kicker: '食材观察', description: '留下食材尝试和当天观察。', icon: '食', group: 'baby', tone: 'orange', status: 'planned',
    stages: ['feeding'], primaryAction: '记一次尝试', helper: '仅保存观察，不评价过敏或安全性。',
  },
  {
    id: 'reports', title: '产检报告', kicker: '私有归档', description: '保存报告原图，手动核对记录字段。', icon: '检', group: 'pregnancy', tone: 'lilac', status: 'planned',
    stages: ['early', 'middle', 'late'], primaryAction: '添加报告', helper: '仅本人可见，自动识别尚未开放。',
  },
  {
    id: 'poster', title: '孕期海报', kicker: '阶段分享', description: '固定模板生成并保存阶段纪念卡。', icon: '卡', group: 'memory', tone: 'rose', status: 'preview',
    stages: ['early', 'middle', 'late'], primaryAction: '生成海报', helper: '预览后再保存到相册。',
  },
  {
    id: 'diary', title: '孕育日记', kicker: '每日一笔', description: '写下当天心情与一小段日记。', icon: '记', group: 'memory', tone: 'lilac', status: 'planned',
    stages: ['preparing', 'early', 'middle', 'late', 'newborn', 'feeding'], primaryAction: '写一笔日记', helper: '图文与周回顾仍在完善中。',
  },
  {
    id: 'album', title: '成长相册', kicker: '时光档案', description: '选择照片，建立本机照片记录。', icon: '册', group: 'memory', tone: 'rose', status: 'planned',
    stages: ['newborn', 'feeding'], primaryAction: '添加照片', helper: '云端照片与纪念卡尚未开放。',
  },
  {
    id: 'expenses', title: '孕育记账', kicker: '家庭账本', description: '记录家庭支出、分类和备注。', icon: '账', group: 'memory', tone: 'orange', status: 'planned',
    stages: ['preparing', 'early', 'middle', 'late', 'newborn', 'feeding'], primaryAction: '记一笔账', helper: '退款和月度汇总仍在完善中。',
  },
  {
    id: 'names', title: '宝宝起名', kicker: '静态名字库', description: '筛选候选名字，收藏后慢慢讨论。', icon: '名', group: 'planning', tone: 'orange', status: 'preview',
    stages: ['preparing', 'early', 'middle', 'late'], primaryAction: '挑选名字', helper: '静态名字库预览，出处与寓意供参考。',
  },
]

export const TOOL_BY_ID = Object.fromEntries(TOOL_DEFINITIONS.map(tool => [tool.id, tool])) as Record<ToolId, ToolDefinition>

export function getToolDefinition(value: unknown): ToolDefinition {
  return TOOL_BY_ID[String(value) as ToolId] || TOOL_BY_ID.calendar
}

export function getToolStage(week: number | null, babyBirthday?: string | null): ToolStage {
  if (babyBirthday) {
    const period = currentToolPeriod(week, babyBirthday)
    return period?.stage === 'postpartum' ? (period.week >= 27 ? 'feeding' : 'newborn') : 'preparing'
  }
  if (!week) return 'preparing'
  if (week <= 12) return 'early'
  if (week <= 27) return 'middle'
  return 'late'
}

export function getStageLabel(stage: ToolStage): string {
  return {
    preparing: '备孕/待完善', early: '孕早期', middle: '孕中期', late: '孕晚期', newborn: '新生儿期', feeding: '辅食阶段',
  }[stage]
}

export function getToneClass(tone: ToolTone): string {
  return `tool-tone--${tone}`
}

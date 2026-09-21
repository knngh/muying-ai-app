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
  { id: 'planning', title: '待产与计划', description: '按出生阶段准备清单、接种和家庭讨论。' },
  { id: 'baby', title: '宝宝照护', description: '从出生后的喂养、睡眠到生长和辅食。' },
  { id: 'memory', title: '回忆与生活', description: '保存照片、文字和家庭共同的阶段记录。' },
]

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'calendar', title: '孕育日历', kicker: '记录底座', description: '按孕周或成长阶段查看提醒、待办和已经留下的记录。', icon: '日', group: 'pregnancy', tone: 'orange', status: 'ready',
    stages: ['preparing', 'early', 'middle', 'late', 'newborn', 'feeding'], primaryAction: '打开日历', helper: '原有日历继续作为所有记录的入口。',
  },
  {
    id: 'contractions', title: '宫缩计时', kicker: '孕晚期工具', description: '记录每次开始和结束时间，回看持续时间与间隔。', icon: '时', group: 'pregnancy', tone: 'rose', status: 'planned',
    stages: ['late'], primaryAction: '开始记录', helper: '只做计时，不进行诊断或风险评分。',
  },
  {
    id: 'movement', title: '胎动计数', kicker: '按医嘱记录', description: '选择记录方式，点按保存每一次胎动并支持撤销。', icon: '动', group: 'pregnancy', tone: 'rose', status: 'planned',
    stages: ['middle', 'late'], primaryAction: '开始计数', helper: '计数结果只保存事实，如有疑虑请咨询医生。',
  },
  {
    id: 'weight', title: '孕期体重', kicker: '趋势记录', description: '记录测量值，查看个人变化与适用的参考带。', icon: '重', group: 'pregnancy', tone: 'green', status: 'planned',
    stages: ['early', 'middle', 'late'], primaryAction: '记录体重', helper: '参考区间只做对照，不输出合格或不合格。',
  },
  {
    id: 'care', title: '喂养三件套', kicker: '新生儿照护', description: '喂奶、换尿布和睡眠分开记录，今日时间线一眼可见。', icon: '护', group: 'baby', tone: 'green', status: 'planned',
    stages: ['newborn', 'feeding'], primaryAction: '记一笔照护', helper: '未知奶量保留为未知，不当作 0。',
  },
  {
    id: 'growth', title: '宝宝生长', kicker: '成长曲线', description: '保存身高、体重和头围，按月龄查看来源明确的曲线。', icon: '长', group: 'baby', tone: 'green', status: 'planned',
    stages: ['newborn', 'feeding'], primaryAction: '记录测量', helper: '百分位用于展示，不做诊断或打分。',
  },
  {
    id: 'packing', title: '待产包清单', kicker: '家庭协作', description: '按妈妈、宝宝和证件分类准备，后续支持家人认领。', icon: '包', group: 'planning', tone: 'orange', status: 'planned',
    stages: ['middle', 'late'], primaryAction: '查看清单', helper: '医院要求可调整，购买和认领是两件事。',
  },
  {
    id: 'vaccines', title: '疫苗时间表', kicker: '按出生日期', description: '区分参考计划、预约和实际接种，保存每一剂事实。', icon: '苗', group: 'planning', tone: 'green', status: 'planned',
    stages: ['newborn', 'feeding'], primaryAction: '查看计划', helper: '补种和禁忌由接种门诊确认。',
  },
  {
    id: 'foods', title: '辅食添加', kicker: '食材观察', description: '记录尝试过的食材和观察备注，不强迫连续打卡。', icon: '食', group: 'baby', tone: 'orange', status: 'planned',
    stages: ['feeding'], primaryAction: '记一次尝试', helper: '适用时机和高风险情况以核验资料为准。',
  },
  {
    id: 'reports', title: '产检报告', kicker: '私有归档', description: '原图和字段对照保存，确认前始终标记为待核对。', icon: '检', group: 'pregnancy', tone: 'lilac', status: 'planned',
    stages: ['early', 'middle', 'late'], primaryAction: '添加报告', helper: '先做好私有上传和字段核对，再接 OCR。',
  },
  {
    id: 'poster', title: '孕期海报', kicker: '阶段分享', description: '用真实孕周和固定模板生成可以保存的阶段卡片。', icon: '卡', group: 'memory', tone: 'rose', status: 'preview',
    stages: ['early', 'middle', 'late'], primaryAction: '生成海报', helper: '预览与导出一致，不把点击分享当作已送达。',
  },
  {
    id: 'diary', title: '孕育日记', kicker: '每日一笔', description: '图文和心情可以每天留下，周回顾只引用真实记录。', icon: '记', group: 'memory', tone: 'lilac', status: 'planned',
    stages: ['preparing', 'early', 'middle', 'late', 'newborn', 'feeding'], primaryAction: '写一笔日记', helper: '原文和整理草稿分开保存。',
  },
  {
    id: 'album', title: '成长相册', kicker: '时光档案', description: '按月龄整理照片，满月、百天和周岁可生成纪念卡。', icon: '册', group: 'memory', tone: 'rose', status: 'planned',
    stages: ['newborn', 'feeding'], primaryAction: '添加照片', helper: '照片权限和删除引用会单独确认。',
  },
  {
    id: 'expenses', title: '孕育记账', kicker: '家庭账本', description: '记录支出、退款和分类，按月查看养娃花费结构。', icon: '账', group: 'memory', tone: 'orange', status: 'planned',
    stages: ['preparing', 'early', 'middle', 'late', 'newborn', 'feeding'], primaryAction: '记一笔账', helper: '金额由程序计算，原始票据不进入分析埋点。',
  },
  {
    id: 'names', title: '宝宝起名', kicker: '静态名字库', description: '按姓氏、风格和避讳字筛选候选名，收藏后和家人讨论。', icon: '名', group: 'planning', tone: 'orange', status: 'preview',
    stages: ['preparing', 'early', 'middle', 'late'], primaryAction: '挑选名字', helper: '候选库需经过出处、拼音和敏感内容审核。',
  },
]

export const TOOL_BY_ID = Object.fromEntries(TOOL_DEFINITIONS.map(tool => [tool.id, tool])) as Record<ToolId, ToolDefinition>

export function getToolDefinition(value: unknown): ToolDefinition {
  return TOOL_BY_ID[String(value) as ToolId] || TOOL_BY_ID.calendar
}

export function getToolStage(week: number | null, babyBirthday?: string | null): ToolStage {
  if (babyBirthday) {
    const birthday = new Date(`${babyBirthday}T00:00:00`)
    const months = Number.isNaN(birthday.getTime()) ? 0 : Math.max(0, (Date.now() - birthday.getTime()) / (30.44 * 24 * 60 * 60 * 1000))
    return months >= 6 ? 'feeding' : 'newborn'
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

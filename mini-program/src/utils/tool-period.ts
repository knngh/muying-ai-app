import type { ToolId } from '../data/tool-catalog'

export interface ToolPeriod { stage: 'pregnancy' | 'postpartum'; week: number }
export interface PeriodTool { id: ToolId; reason: string }

export function parseToolPeriod(stage: unknown, week: unknown): ToolPeriod | null {
  const value = typeof week === 'number' ? week : typeof week === 'string' && /^\d+$/.test(week) ? Number(week) : NaN
  if ((stage !== 'pregnancy' && stage !== 'postpartum') || !Number.isInteger(value)
    || value < 1 || value > (stage === 'pregnancy' ? 40 : 156)) return null
  return { stage, week: value }
}

export function currentToolPeriod(week: number | null, birthday?: string | null, now = new Date()): ToolPeriod | null {
  if (!birthday) return parseToolPeriod('pregnancy', week)
  const date = birthday.slice(0, 10)
  const birth = new Date(`${date}T00:00:00Z`)
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(birth.getTime())
    || birth.toISOString().slice(0, 10) !== date || birth.getTime() > today) return null
  return { stage: 'postpartum', week: Math.min(156, Math.floor((today - birth.getTime()) / (7 * 86400000)) + 1) }
}

export function toolPeriodLabel(period: ToolPeriod): string {
  return period.stage === 'pregnancy' ? `孕 ${period.week} 周` : `出生后第 ${period.week} 周`
}

// Product discovery windows only: these are not examination schedules or clinical thresholds.
export function periodTools(period: ToolPeriod | null): PeriodTool[] {
  if (!period || !parseToolPeriod(period.stage, period.week)) return []
  const { stage, week } = period
  if (stage === 'postpartum') {
    if (week <= 4) return [
      { id: 'care', reason: '随手记下喂奶、尿布和睡眠' },
      { id: 'vaccines', reason: '按接种门诊安排，保存预约与接种记录' },
      { id: 'diary', reason: '留下初次相处的感受与心情' },
    ]
    if (week <= 12) return [
      { id: 'care', reason: '接着记录宝宝每天的照护事项' },
      { id: 'growth', reason: '儿保测量后，保存身高、体重和头围' },
      { id: 'album', reason: '留一张照片，记下这周的变化' },
    ]
    if (week <= 26) return [
      { id: 'growth', reason: '保存每次测量，方便之后回看' },
      { id: 'vaccines', reason: '回看已种记录，按门诊安排下一次接种' },
      { id: 'album', reason: '把新表情和小变化留在相册里' },
    ]
    return [
      { id: 'foods', reason: '开始添加辅食后，记录新食材与观察' },
      { id: 'growth', reason: '儿保测量后，补充本次生长记录' },
      week <= 52 ? { id: 'care', reason: '继续记录喂养与睡眠，方便日常照护' }
        : { id: 'expenses', reason: '整理这一阶段的育儿支出' },
    ]
  }
  if (week <= 13) return [
    { id: 'reports', reason: '检查后保存报告原图，复诊时方便查找' },
    { id: 'weight', reason: '记下体重，慢慢积累个人变化记录' },
    { id: 'diary', reason: '写下身体感受和想在产检时问的事' },
  ]
  if (week <= 19) return [
    { id: 'weight', reason: '延续体重记录，回看自己的变化' },
    { id: 'reports', reason: '将新报告归档，手动核对关键字段' },
    { id: 'diary', reason: '把这周的新感受留给未来的自己' },
  ]
  if (week <= 27) return [
    { id: 'reports', reason: '把这一阶段的检查资料收好' },
    { id: 'packing', reason: '提前看看待产要准备什么，按需勾选' },
    { id: 'names', reason: '慢慢挑选喜欢的名字，收藏候选' },
  ]
  if (week <= 36) return [
    { id: 'movement', reason: '若医生建议计数，可在这里保存胎动记录' },
    { id: 'packing', reason: '逐项核对妈妈、宝宝和证件用品' },
    { id: 'weight', reason: '继续保存测量，不用凭记忆回想' },
  ]
  return [
    { id: 'contractions', reason: '需要时记录宫缩起止，就医安排请遵医嘱' },
    { id: 'movement', reason: '按医嘱继续记录，有疑虑及时咨询医生' },
    { id: 'packing', reason: '再核对一次入院需要携带的物品' },
  ]
}

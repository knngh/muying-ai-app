import type { LocalToolRecord } from './tool-records'
import { expenseCategoryLabel, expenseDirectionLabel, formatExpenseCents, parseExpenseCents } from './expense-ledger'

export function localToolDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
const labels: Record<string, string> = {
  feeding: '喂奶', diaper: '换尿布', sleep: '睡眠', left: '左侧', right: '右侧', bottle: '奶瓶', mixed: '混合',
  wet: '尿湿', stool: '便便', both: '尿湿+便便', height: '身高', weight: '体重', head: '头围',
  checkup: '产检', supplies: '待产包', vaccine: '疫苗', administered: '已接种', scheduled: '已预约',
  unconfirmed: '待确认', planned: '计划中', free: '自由计数',
}
export function historyDate(record: LocalToolRecord): string {
  const p = record.payload
  const date = p.measuredAt || p.date || p.recordedAt || p.startedAt || p.startAt || record.createdAt
  if (typeof date !== 'string') return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  const value = new Date(date)
  return Number.isFinite(value.getTime()) ? `${localToolDate(value)} ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}` : ''
}
export function historyDetails(record: LocalToolRecord): Array<{ label: string; value: string }> {
  const p = record.payload
  const fields: Array<[string, unknown]> = []
  const text = (value: unknown) => typeof value === 'string' ? labels[value] || value : value
  switch (record.toolId) {
    case 'contractions': fields.push(['开始时间', p.startAt], ['结束时间', p.endAt], ['持续秒数', p.durationSeconds], ['间隔秒数', p.intervalSeconds]); break
    case 'movement': fields.push(['次数', p.count], ['开始时间', p.startedAt], ['结束时间', p.endedAt]); break
    case 'weight': fields.push(['体重', `${p.value} kg`]); break
    case 'care': {
      fields.push(['照护类型', text(p.kind)], ['喂养方式', text(p.side)], ['尿布类型', text(p.diaperType)], ['奶量（ml）', p.amount])
      if (typeof p.recordedAt === 'string' && typeof p.endedAt === 'string') {
        const seconds = Math.max(0, Math.floor((Date.parse(p.endedAt) - Date.parse(p.recordedAt)) / 1000))
        if (Number.isFinite(seconds) && Date.parse(p.endedAt) > Date.parse(p.recordedAt)) fields.push(['开始时间', p.recordedAt], ['结束时间', p.endedAt], ['持续时间', `${Math.floor(seconds / 60)} 分钟${seconds % 60 ? ` ${seconds % 60} 秒` : ''}`])
      }
      fields.push(['备注', p.note])
      break
    }
    case 'growth': fields.push(['测量项目', text(p.metric)], ['测量值', `${p.value} ${p.unit || ''}`]); break
    case 'packing': fields.push(['物品', p.item], ['状态', p.done ? '已准备' : '未准备']); break
    case 'vaccines': fields.push(['疫苗名称', p.name], ['接种状态', text(p.status)], ['原预约日期', p.appointmentDate]); break
    case 'foods': fields.push(['食材', p.name], ['观察', p.note]); break
    case 'diary': fields.push(['心情', p.mood], ['日记全文', p.content]); break
    case 'expenses': fields.push(['金额', expenseAmountText(p.amount)], ['类型', expenseDirectionLabel(record)], ['分类', expenseCategoryLabel(p.category)], ['备注', p.note]); break
    case 'poster': fields.push(['制作时孕周', p.week ? `第 ${p.week} 周` : '今日阶段卡']); break
    case 'album': fields.push(['照片日期', p.date]); break
    case 'reports': fields.push(['报告名称', p.name], ['备注', p.note]); break
    default: fields.push(['内容', p.note || p.name || p.summary]);
  }
  return fields.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => ({
    label, value: typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) ? historyDate({ ...record, payload: { date: value } }) : String(value),
  }))
}
export function historyTitle(record: LocalToolRecord): string {
  if (record.toolId === 'care') {
    const title = `${labels[String(record.payload.kind)] || '照护记录'}${record.payload.amount == null ? '' : ` ${record.payload.amount} ml`}`
    if (record.payload.kind === 'sleep' && typeof record.payload.recordedAt === 'string' && typeof record.payload.endedAt === 'string') {
      const seconds = Math.max(0, Math.floor((Date.parse(record.payload.endedAt) - Date.parse(record.payload.recordedAt)) / 1000))
      if (Number.isFinite(seconds) && seconds > 0) return `${title} · ${seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分钟`}`
    }
    return title
  }
  if (record.toolId === 'growth') return `${labels[String(record.payload.metric)] || '生长记录'} ${record.payload.value} ${record.payload.unit || ''}`
  if (record.toolId === 'vaccines') return `${record.payload.name} · ${labels[String(record.payload.status)] || record.payload.status}`
  if (record.toolId === 'expenses') return `${expenseDirectionLabel(record)} · ${expenseCategoryLabel(record.payload.category)} ${expenseAmountText(record.payload.amount)}`
  return typeof record.payload.summary === 'string' ? record.payload.summary : '已保存记录'
}
function expenseAmountText(value: unknown): string {
  const cents = parseExpenseCents(value)
  return cents === null ? `原金额：${value ?? '未填写'}（待核对）` : `${formatExpenseCents(cents)} 元`
}

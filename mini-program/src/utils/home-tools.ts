import { TOOL_BY_ID, TOOL_DEFINITIONS, type ToolId, type ToolStage, type ToolGroup } from '../data/tool-catalog'
import { parseToolPeriod, periodTools, type ToolPeriod } from './tool-period'

const KEY = 'beihu:home-tools:v1'
export const MAX_HOME_TOOLS = 8
const recommendations: Record<ToolStage, ToolId[]> = {
  preparing: ['calendar', 'diary', 'expenses', 'names'],
  early: ['calendar', 'diary', 'reports', 'weight'],
  middle: ['movement', 'weight', 'calendar', 'packing'],
  late: ['contractions', 'movement', 'packing', 'calendar'],
  newborn: ['care', 'diary', 'growth', 'vaccines'],
  feeding: ['care', 'foods', 'growth', 'vaccines'],
}
export function normalizeHomeTools(value: unknown): ToolId[] | null {
  if (!Array.isArray(value)) return null
  return [...new Set(value.filter((id): id is ToolId => typeof id === 'string' && Object.prototype.hasOwnProperty.call(TOOL_BY_ID, id)))].slice(0, MAX_HOME_TOOLS)
}
export function recommendedHomeTools(stage: ToolStage, period?: ToolPeriod | null): ToolId[] {
  const contextual = periodTools(period ?? null)
  return contextual.length ? [...new Set<ToolId>(['calendar', ...contextual.map(tool => tool.id), 'poster'])] : [...recommendations[stage], 'poster']
}
export function readHomeTools(): ToolId[] | null { return normalizeHomeTools(uni.getStorageSync(KEY)) }
export function saveHomeTools(ids: ToolId[]) { uni.setStorageSync(KEY, normalizeHomeTools(ids) || []) }
export function resetHomeTools() { uni.removeStorageSync(KEY) }
export function moveHomeTool(ids: ToolId[], index: number, direction: -1 | 1): ToolId[] {
  const next = [...ids], target = index + direction
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
const aliases: Partial<Record<ToolId, string>> = {
  calendar: '产检 提醒 预约 待办', contractions: '宫缩 计时 临产', movement: '胎动 踢一下 计数',
  care: '喂奶 喂养 尿布 睡眠 睡觉 母乳 奶量', growth: '身高 身长 头围 宝宝体重',
  packing: '待产包 购物 准备 证件', vaccines: '打针 疫苗 接种', foods: '辅食 食材 试吃',
  reports: '化验单 报告 拍照 归档 检查', poster: '海报 分享 阶段卡 图片',
  album: '相册 照片 成长', expenses: '支出 记账 花费 账本', names: '名字 起名 取名',
}
export function findTools(query: string, group: ToolGroup | 'all' = 'all') {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return TOOL_DEFINITIONS.filter(tool => (group === 'all' || group === tool.group)
    && words.every(word => `${tool.title} ${tool.description} ${aliases[tool.id] || ''}`.toLowerCase().includes(word)))
}
export function openToolPage(id: ToolId, period?: ToolPeriod | null, recordId?: string) {
  if (id === 'calendar') uni.switchTab({ url: '/pages/calendar/index' })
  else {
    const context = period && parseToolPeriod(period.stage, period.week)
    const query = `${context ? `&fromStage=${context.stage}&fromWeek=${context.week}` : ''}${recordId ? `&recordId=${encodeURIComponent(recordId)}` : ''}`
    uni.navigateTo({ url: id === 'names' ? '/pages/name-library/index' : `/pages/tool-detail/index?id=${id}${query}` })
  }
}

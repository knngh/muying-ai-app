export type PackingGroup = '证件' | '妈妈' | '宝宝'

export interface PackingItem {
  name: string
  group: PackingGroup
  quantity: string
}

export const PACKING_GROUPS: Array<{ value: PackingGroup; label: string }> = [
  { value: '妈妈', label: '妈妈用品' },
  { value: '宝宝', label: '宝宝用品' },
  { value: '证件', label: '证件与其他' },
]

export const PACKING_ITEMS: PackingItem[] = [
  { name: '证件与产检资料', group: '证件', quantity: '1 份' },
  { name: '医保卡/就诊卡', group: '证件', quantity: '按需' },
  { name: '手机与充电器', group: '证件', quantity: '1 套' },
  { name: '现金或支付工具', group: '证件', quantity: '按需' },
  { name: '产褥垫', group: '妈妈', quantity: '1 包' },
  { name: '一次性内裤', group: '妈妈', quantity: '若干' },
  { name: '哺乳内衣', group: '妈妈', quantity: '2 件' },
  { name: '防溢乳垫', group: '妈妈', quantity: '1 包' },
  { name: '产妇卫生巾', group: '妈妈', quantity: '1 包' },
  { name: '洗漱用品', group: '妈妈', quantity: '1 套' },
  { name: '拖鞋和出院衣物', group: '妈妈', quantity: '各 1' },
  { name: '吸管杯或带吸管水杯', group: '妈妈', quantity: '1 个' },
  { name: '新生儿衣物', group: '宝宝', quantity: '2 套' },
  { name: '纸尿裤', group: '宝宝', quantity: '1 小包' },
  { name: '包被', group: '宝宝', quantity: '1-2 条' },
  { name: '小方巾', group: '宝宝', quantity: '2–3 条' },
  { name: '婴儿湿巾', group: '宝宝', quantity: '1 包' },
  { name: '护臀用品', group: '宝宝', quantity: '按需' },
  { name: '新生儿帽子', group: '宝宝', quantity: '1 顶' },
]

export function packingDoneCount(items: PackingItem[], doneNames: ReadonlySet<string>): number {
  return items.filter(item => doneNames.has(item.name)).length
}

export function buildPackingShareText(items: PackingItem[], doneNames: ReadonlySet<string>): string {
  const lines = ['贝护待产包清单', '请结合医院要求和个人情况核对：']
  for (const group of PACKING_GROUPS) {
    lines.push('', `【${group.label}】`)
    for (const item of items.filter(value => value.group === group.value)) lines.push(`${doneNames.has(item.name) ? '☑' : '□'} ${item.name} · ${item.quantity}`)
  }
  lines.push('', '清单仅作整理参考，医院入院要求请以院方为准。')
  return lines.join('\n')
}

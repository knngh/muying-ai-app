import { PACKING_GROUPS, PACKING_ITEMS, buildPackingShareText, packingDoneCount } from '../mini-program/src/utils/packing-items'

it('ships a grouped starter list with quantity hints and stable progress', () => {
  expect(PACKING_ITEMS.length).toBeGreaterThan(15)
  expect(new Set(PACKING_ITEMS.map(item => item.group))).toEqual(new Set(PACKING_GROUPS.map(item => item.value)))
  expect(packingDoneCount(PACKING_ITEMS, new Set(['产褥垫', '纸尿裤']))).toBe(2)
})

it('builds a copyable checklist without claiming hospital-specific completeness', () => {
  const text = buildPackingShareText(PACKING_ITEMS, new Set(['产褥垫']))
  expect(text).toContain('☑ 产褥垫 · 1 包')
  expect(text).toContain('□ 纸尿裤 · 1 小包')
  expect(text).toContain('医院入院要求请以院方为准')
})

import { currentToolPeriod, parseToolPeriod, periodTools } from '../mini-program/src/utils/tool-period';

const ids = (week: number, stage: 'pregnancy' | 'postpartum' = 'pregnancy') => periodTools({ stage, week }).map(tool => tool.id);

it('only promotes movement and contraction tools in their discovery windows', () => {
  for (let week = 1; week <= 40; week++) {
    expect(ids(week).includes('movement')).toBe(week >= 28);
    expect(ids(week).includes('contractions')).toBe(week >= 37);
    expect(ids(week)).toHaveLength(3);
    expect(new Set(ids(week)).size).toBe(3);
  }
  expect(ids(13)).toContain('diary');
  expect(ids(20)).toContain('names');
  expect(ids(27)).not.toContain('movement');
});
it('replaces pregnancy tools with care and later food records after birth', () => {
  expect(ids(1, 'postpartum')).toContain('care');
  expect(ids(4, 'postpartum')).toContain('vaccines');
  expect(ids(5, 'postpartum')).toContain('growth');
  expect(ids(26, 'postpartum')).not.toContain('foods');
  expect(ids(27, 'postpartum')).toContain('foods');
  expect(ids(53, 'postpartum')).toContain('expenses');
  for (let week = 1; week <= 156; week++) {
    expect(ids(week, 'postpartum')).toHaveLength(3);
    expect(ids(week, 'postpartum')).not.toEqual(expect.arrayContaining(['movement']));
  }
});
it('keeps unknown stages neutral and rejects malformed or out-of-range route context', () => {
  expect(periodTools(null)).toEqual([]);
  for (const week of ['28abc', '0', '-1', '41', 2.5, null]) expect(parseToolPeriod('pregnancy', week)).toBeNull();
  expect(parseToolPeriod('unknown', 28)).toBeNull();
  expect(parseToolPeriod('pregnancy', '28')).toEqual({ stage: 'pregnancy', week: 28 });
  expect(parseToolPeriod('postpartum', '156')).toEqual({ stage: 'postpartum', week: 156 });
});
it('uses birthday ahead of a stale pregnancy week and counts calendar days', () => {
  const today = new Date(2026, 8, 21, 9);
  expect(currentToolPeriod(38, '2026-09-21', today)).toEqual({ stage: 'postpartum', week: 1 });
  expect(currentToolPeriod(38, '2026-09-14', today)).toEqual({ stage: 'postpartum', week: 2 });
  expect(currentToolPeriod(28, null, today)).toEqual({ stage: 'pregnancy', week: 28 });
  for (const birthday of ['invalid', '2026-02-30', '2026-09-22']) expect(currentToolPeriod(38, birthday, today)).toBeNull();
});

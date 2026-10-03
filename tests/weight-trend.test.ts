import { weightChartLayout, weightPoints } from '../mini-program/src/utils/weight-trend';
import type { LocalToolRecord } from '../mini-program/src/utils/tool-records';

function record(date: string, value: number, id = date): LocalToolRecord {
  return { id, toolId: 'weight', recordType: 'measurement', createdAt: date, updatedAt: date, syncStatus: 'local', payload: { measuredAt: date, value } };
}

it('plots elapsed dates rather than equal spacing between records', () => {
  const points = weightPoints([record('2026-09-11', 63), record('2026-09-01', 61), record('2026-09-02', 62)]);
  expect(weightChartLayout(points).points.map(point => point.x)).toEqual([0, .1, 1]);
});

it('rejects corrupt dates and values before counting or plotting', () => {
  expect(weightPoints([record('2026-02-30', 61), record('invalid', 61), record('2026-09-01', NaN), record('2026-09-01', Infinity), record('2026-09-01', -1)])).toEqual([]);
  expect(weightPoints([record('2024-02-29', 61), record('2026-09-01T00:00:00.000Z', 62)])).toHaveLength(2);
});

it('keeps same-day readings centered and flat values finite', () => {
  const result = weightChartLayout(weightPoints([record('2026-09-01', 61, 'a'), record('2026-09-01', 61, 'b')]));
  expect(result.points.map(point => point.x)).toEqual([.5, .5]);
  expect(result.points.every(point => Number.isFinite(point.y))).toBe(true);
  expect(result.upper).toBeGreaterThan(result.lower);
});

it('shows the latest twelve measurement dates, independent of save order', () => {
  const points = weightPoints(Array.from({ length: 15 }, (_, i) => record(`2026-09-${String(15 - i).padStart(2, '0')}`, 61)));
  expect(points).toHaveLength(12);
  expect(points[0].date).toBe('2026-09-04');
  expect(points[11].date).toBe('2026-09-15');
});

it('shows the most recently saved measurement last when dates are equal', () => {
  const newer = { ...record('2026-09-21', 62, 'new'), createdAt: '2026-09-21T10:00:00Z' };
  const older = { ...record('2026-09-21', 61, 'old'), createdAt: '2026-09-21T08:00:00Z' };
  expect(weightPoints([newer, older]).map(point => point.value)).toEqual([61, 62]);
});

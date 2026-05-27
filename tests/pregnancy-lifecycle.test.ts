import { updateProfileBody } from '../src/schemas/auth.schema';
import {
  calculateDueDateFromPregnancyWeek,
  calculatePregnancyWeekFromDueDate,
  resolveLifecycleStage,
} from '../src/utils/pregnancy';

function localDateString(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

describe('pregnancy lifecycle guards', () => {
  it('prefers due date when profile data is conflicted', () => {
    const stage = resolveLifecycleStage(3, new Date('2026-12-05T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z'));
    expect(stage).toBe('pregnant');
  });

  it('treats baby birthday as postpartum when due date is absent', () => {
    const stage = resolveLifecycleStage(2, null, new Date('2026-01-01T00:00:00.000Z'));
    expect(stage).toBe('postpartum');
  });

  it('rejects setting due date and baby birthday together', () => {
    expect(() => updateProfileBody.parse({
      dueDate: '2026-12-05',
      babyBirthday: '2026-01-01',
    })).toThrow('预产期和宝宝生日不能同时设置');
  });

  it('rejects impossible profile lifecycle dates', () => {
    expect(updateProfileBody.safeParse({ dueDate: '2026-02-31' }).success).toBe(false);
    expect(updateProfileBody.safeParse({ babyBirthday: '2026-13-01' }).success).toBe(false);
    expect(updateProfileBody.safeParse({ dueDate: '2026-12-05T00:00:00.000Z' }).success).toBe(false);
  });

  it('round trips selected pregnancy week through due date', () => {
    const baseDate = new Date('2026-05-27T00:00:00.000Z');
    const dueDate = calculateDueDateFromPregnancyWeek(12, baseDate);

    expect(dueDate ? localDateString(dueDate) : null).toBe('2026-12-09');
    expect(dueDate ? calculatePregnancyWeekFromDueDate(dueDate, baseDate) : null).toBe(12);
  });

  it('uses remaining full-or-partial weeks when deriving pregnancy week from due date', () => {
    const baseDate = new Date('2026-05-27T00:00:00.000Z');

    expect(calculatePregnancyWeekFromDueDate(new Date('2026-12-08T00:00:00.000Z'), baseDate)).toBe(12);
    expect(calculatePregnancyWeekFromDueDate(new Date('2026-12-10T00:00:00.000Z'), baseDate)).toBe(11);
  });
});

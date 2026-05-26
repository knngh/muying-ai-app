import {
  calculatePostpartumWeek,
  getPostpartumStorageWeek,
  parseTimelineKey,
  parseTimelinePeriodInput,
  resolveTimelineBabyBirthday,
  toTimelinePeriodFromStorageWeek,
} from '../src/utils/timeline';

describe('timeline utilities', () => {
  it('maps pregnancy and postpartum timeline keys to storage weeks', () => {
    expect(parseTimelineKey('pregnancy:w24')).toEqual(expect.objectContaining({
      timelineKey: 'pregnancy:w24',
      stage: 'pregnancy',
      week: 24,
      storageWeek: 24,
    }));

    expect(parseTimelineKey('postpartum:w01')).toEqual(expect.objectContaining({
      timelineKey: 'postpartum:w01',
      stage: 'postpartum',
      week: 1,
      storageWeek: 41,
    }));

    expect(parseTimelineKey('postpartum:w156')).toEqual(expect.objectContaining({
      timelineKey: 'postpartum:w156',
      storageWeek: 196,
    }));
  });

  it('rejects timeline keys outside supported ranges', () => {
    expect(parseTimelineKey('pregnancy:w41')).toBeNull();
    expect(parseTimelineKey('postpartum:w00')).toBeNull();
    expect(parseTimelineKey('postpartum:w157')).toBeNull();
    expect(parseTimelineKey('baby:w01')).toBeNull();
  });

  it('keeps legacy week storage compatible', () => {
    expect(parseTimelinePeriodInput({ week: 12 })).toEqual(expect.objectContaining({
      timelineKey: 'pregnancy:w12',
      storageWeek: 12,
    }));

    expect(parseTimelinePeriodInput({ week: 44 })).toEqual(expect.objectContaining({
      timelineKey: 'postpartum:w04',
      week: 4,
      storageWeek: 44,
    }));

    expect(toTimelinePeriodFromStorageWeek(getPostpartumStorageWeek(8))).toEqual(expect.objectContaining({
      timelineKey: 'postpartum:w08',
      week: 8,
      storageWeek: 48,
    }));
  });

  it('calculates postpartum week from baby birthday with a three-year cap', () => {
    expect(calculatePostpartumWeek(
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-01T12:00:00.000Z'),
    )).toBe(1);

    expect(calculatePostpartumWeek(
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-29T00:00:00.000Z'),
    )).toBe(5);

    expect(calculatePostpartumWeek(
      new Date('2022-01-01T00:00:00.000Z'),
      new Date('2026-05-01T00:00:00.000Z'),
    )).toBe(156);
  });

  it('prefers user baby birthday over growth profile birthday', () => {
    expect(resolveTimelineBabyBirthday({
      userBabyBirthday: new Date('2026-02-02T00:00:00.000Z'),
      growthProfileBirthday: new Date('2026-01-01T00:00:00.000Z'),
    })).toEqual({
      babyBirthday: new Date('2026-02-02T00:00:00.000Z'),
      source: 'user',
    });

    expect(resolveTimelineBabyBirthday({
      userBabyBirthday: null,
      growthProfileBirthday: new Date('2026-01-01T00:00:00.000Z'),
    })).toEqual({
      babyBirthday: new Date('2026-01-01T00:00:00.000Z'),
      source: 'growth_profile',
    });
  });
});

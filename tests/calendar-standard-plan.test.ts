import {
  buildStandardScheduleEventPayload,
  buildStandardSchedulePlan,
  getMissingStandardScheduleDefinitions,
} from '../src/utils/calendar-standard-plan';

describe('calendar standard plan', () => {
  it('returns an available infant plan with pending and generated items', () => {
    const babyBirthday = new Date('2026-01-01T00:00:00.000Z');
    const plan = buildStandardSchedulePlan({
      user: {
        pregnancyStatus: 3,
        babyBirthday,
      },
      existingEvents: [
        { id: 1n, reminderType: 'std-hc1m', status: 0 },
      ],
      now: new Date('2026-02-15T00:00:00.000Z'),
    });

    expect(plan.available).toBe(true);
    expect(plan.lifecycleKey).toBe('infant_0_6');
    expect(plan.generatedCount).toBeGreaterThan(0);
    expect(plan.pendingCount).toBeGreaterThan(0);
    expect(plan.items.some((item) => item.key === 'std-hc1m' && item.status === 'scheduled')).toBe(true);
    expect(plan.items.some((item) => item.key === 'std-hc3m')).toBe(true);
  });

  it('returns unavailable for pregnancy users without baby birthday', () => {
    const plan = buildStandardSchedulePlan({
      user: {
        pregnancyStatus: 2,
        dueDate: new Date('2026-08-01T00:00:00.000Z'),
      },
      existingEvents: [],
      now: new Date('2026-04-16T00:00:00.000Z'),
    });

    expect(plan.available).toBe(false);
    expect(plan.items).toEqual([]);
    expect(plan.pendingCount).toBe(0);
  });

  it('builds generated payloads and lists missing definitions', () => {
    const babyBirthday = new Date('2026-01-01T00:00:00.000Z');
    const plan = buildStandardSchedulePlan({
      user: {
        pregnancyStatus: 3,
        babyBirthday,
      },
      existingEvents: [
        { id: 1n, reminderType: 'std-hc1m', status: 1 },
      ],
      now: new Date('2026-02-15T00:00:00.000Z'),
    });

    const missingDefinitions = getMissingStandardScheduleDefinitions(plan);
    expect(missingDefinitions.some((item) => item.key === 'std-hc3m')).toBe(true);

    const payload = buildStandardScheduleEventPayload(babyBirthday, missingDefinitions[0]);
    expect(payload.title).toBeTruthy();
    expect(payload.reminderType).toBe(missingDefinitions[0].key);
    expect(payload.reminderMinutes).toBe(12 * 60);
  });
});

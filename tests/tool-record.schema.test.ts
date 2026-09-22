import {
  babyMeasurementBody,
  contractionRecordBody,
  diaryEntryBody,
  expenseEntryBody,
  foodTrialBody,
  packingItemBody,
  pregnancyWeightRecordBody,
  toolAIReviewBody,
} from '../src/schemas/tool-record.schema';

describe('tool record contracts', () => {
  it('accepts a contraction session with an idempotency key', () => {
    expect(contractionRecordBody.safeParse({
      startedAt: '2026-09-21T08:00:00.000Z', endedAt: '2026-09-21T08:00:48.000Z',
      durationSeconds: 48, intervalSeconds: 320, clientOperationId: 'local-12345678',
    }).success).toBe(true);
  });

  it('rejects invalid pregnancy weight ranges', () => {
    expect(pregnancyWeightRecordBody.safeParse({ measuredAt: '2026-09-21', weightKg: 0 }).success).toBe(false);
    expect(pregnancyWeightRecordBody.safeParse({ measuredAt: '2026-02-31', weightKg: 60 }).success).toBe(false);
  });

  it('keeps diary content required and bounded by the contract', () => {
    expect(diaryEntryBody.safeParse({ entryDate: '2026-09-21', content: '今天完成了产检。' }).success).toBe(true);
    expect(diaryEntryBody.safeParse({ entryDate: '2026-09-21', content: '' }).success).toBe(false);
  });

  it('stores expenses as positive integer cents with a known direction', () => {
    expect(expenseEntryBody.safeParse({ occurredAt: '2026-09-21', amountCents: 26800, category: 'feeding' }).success).toBe(true);
    expect(expenseEntryBody.safeParse({ occurredAt: '2026-09-21', amountCents: 268.5, category: 'feeding' }).success).toBe(false);
  });

  it('requires valid units for baby measurements and records', () => {
    expect(babyMeasurementBody.safeParse({ measuredAt: '2026-09-21', metric: 'height', value: 62, unit: 'cm' }).success).toBe(true);
    expect(foodTrialBody.safeParse({ foodName: '高铁米粉', triedAt: '2026-09-21' }).success).toBe(true);
    expect(packingItemBody.safeParse({ name: '纸尿裤', category: '宝宝', isDone: false }).success).toBe(true);
  });

  it('requires explicit consent and bounded records for AI review', () => {
    const base = { toolId: 'weight', records: [{ date: '2026-09-21', content: '体重 62.4 kg' }] };
    expect(toolAIReviewBody.safeParse({ ...base, consent: true }).success).toBe(true);
    expect(toolAIReviewBody.safeParse({ ...base, consent: false }).success).toBe(false);
  });
});

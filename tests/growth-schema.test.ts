import {
  growthProfileBody,
  growthRecordBody,
  growthRecordsQuery,
} from '../src/schemas/growth.schema';

describe('growth schemas', () => {
  it('normalizes and bounds growth record pagination', () => {
    const parsed = growthRecordsQuery.parse({ page: '2', pageSize: '50', recordType: 'milestone' });

    expect(parsed).toEqual({ page: 2, pageSize: 50, recordType: 'milestone' });
    expect(growthRecordsQuery.safeParse({ pageSize: '0' }).success).toBe(false);
    expect(growthRecordsQuery.safeParse({ pageSize: '51' }).success).toBe(false);
  });

  it('rejects invalid growth profile dates and gender values', () => {
    expect(growthProfileBody.safeParse({ birthday: 'not-a-date' }).success).toBe(false);
    expect(growthProfileBody.safeParse({ gender: 3 }).success).toBe(false);
    expect(growthProfileBody.parse({ birthday: '', gender: '2' })).toEqual({
      birthday: null,
      gender: 2,
    });
  });

  it('rejects invalid growth records before controller writes', () => {
    expect(growthRecordBody.safeParse({ recordType: '', recordedAt: '2026-01-01' }).success).toBe(false);
    expect(growthRecordBody.safeParse({ recordType: 'milestone', recordedAt: 'invalid' }).success).toBe(false);
    expect(growthRecordBody.safeParse({ recordType: 'milestone', note: 'a'.repeat(301) }).success).toBe(false);
  });
});

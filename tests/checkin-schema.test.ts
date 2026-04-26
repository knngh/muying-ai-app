import { pointsLogQuery, redeemPointsBody } from '../src/schemas/checkin.schema';

describe('checkin schemas', () => {
  it('bounds points log pagination', () => {
    expect(pointsLogQuery.parse({ page: '2', pageSize: '50' })).toEqual({ page: 2, pageSize: 50 });
    expect(pointsLogQuery.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(pointsLogQuery.safeParse({ page: '0' }).success).toBe(false);
    expect(pointsLogQuery.safeParse({ pageSize: '51' }).success).toBe(false);
  });

  it('validates redeem points in service-supported increments', () => {
    expect(redeemPointsBody.parse({ points: '300' })).toEqual({ points: 300 });
    expect(redeemPointsBody.safeParse({ points: '50' }).success).toBe(false);
    expect(redeemPointsBody.safeParse({ points: '150' }).success).toBe(false);
    expect(redeemPointsBody.safeParse({ points: '3100' }).success).toBe(false);
  });
});

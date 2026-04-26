import { createAnalyticsEventBody } from '../src/schemas/analytics.schema';

describe('analytics schemas', () => {
  it('accepts bounded JSON properties', () => {
    const parsed = createAnalyticsEventBody.parse({
      eventName: 'app_membership_exposure',
      source: 'app',
      clientId: 'client-12345678',
      properties: {
        entrySource: 'home',
        sourcesCount: 2,
        degraded: false,
        labels: ['vip', 'weekly'],
      },
    });

    expect(parsed.properties).toEqual({
      entrySource: 'home',
      sourcesCount: 2,
      degraded: false,
      labels: ['vip', 'weekly'],
    });
  });

  it('rejects oversized or non-finite analytics properties', () => {
    expect(createAnalyticsEventBody.safeParse({
      eventName: 'app_membership_exposure',
      source: 'app',
      properties: { bad: Number.NaN },
    }).success).toBe(false);

    expect(createAnalyticsEventBody.safeParse({
      eventName: 'app_membership_exposure',
      source: 'app',
      properties: Object.fromEntries(Array.from({ length: 31 }, (_, index) => [`k${index}`, index])),
    }).success).toBe(false);

    expect(createAnalyticsEventBody.safeParse({
      eventName: 'app_membership_exposure',
      source: 'app',
      properties: { payload: 'x'.repeat(4097) },
    }).success).toBe(false);
  });
});

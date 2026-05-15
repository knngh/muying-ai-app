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

  it('rejects server-only AI event names from public analytics writes', () => {
    expect(createAnalyticsEventBody.safeParse({
      eventName: 'server_ai_request_start',
      source: 'app',
      page: 'ChatScreen',
      properties: { endpoint: 'ask' },
    }).success).toBe(false);
  });

  it('accepts client activation events and rejects server lifecycle readiness from public writes', () => {
    expect(createAnalyticsEventBody.safeParse({
      eventName: 'app_knowledge_detail_open',
      source: 'app',
      page: 'KnowledgeDetailScreen',
      clientId: 'client-12345678',
      sessionId: 'session-12345678',
      properties: { articleSlug: 'feeding-guide' },
    }).success).toBe(true);

    expect(createAnalyticsEventBody.safeParse({
      eventName: 'server_lifecycle_profile_ready',
      source: 'app',
      page: 'ProfileScreen',
    }).success).toBe(false);
  });
});

const { buildP6DataClosureReport } = require('../scripts/prod-p6-data-closure-status');

function funnelStep(eventName: string, count: number, uniqueCount: number, unidentifiedCount = 0) {
  return {
    eventName,
    label: eventName,
    count,
    uniqueCount,
    unidentifiedCount,
    conversionRate: count > 0 ? 100 : null,
  };
}

function baseInput(overrides = {}) {
  return {
    generatedAt: '2026-05-15T10:00:00.000Z',
    rangeDays: 7,
    health: { status: 'ok', database: 'ok' },
    legacyHealth: { status: 'ok', database: 'ok' },
    aiHealth: { data: { providerBlocks: [] } },
    funnel: {
      data: {
        rangeDays: 7,
        steps: [
          funnelStep('mini_program_app_download_click', 20, 12),
          funnelStep('app_membership_exposure', 14, 10),
          funnelStep('app_order_created', 5, 4),
          funnelStep('app_payment_success', 3, 3),
          funnelStep('app_weekly_report_open', 8, 6),
          funnelStep('app_growth_archive_share', 2, 2),
        ],
        uniqueSteps: [
          funnelStep('mini_program_app_download_click', 20, 12),
          funnelStep('app_membership_exposure', 14, 10),
          funnelStep('app_order_created', 5, 4),
          funnelStep('app_payment_success', 3, 3),
          funnelStep('app_weekly_report_open', 8, 6),
          funnelStep('app_growth_archive_share', 2, 2),
        ],
        uniqueSummary: {
          firstStepUniqueCount: 12,
          totalIdentifiedEvents: 48,
          totalUnidentifiedEvents: 2,
          identityCoverageRate: 0.96,
        },
      },
    },
    aiOverview: {
      data: {
        serverAi: {
          requestsStarted: 18,
          responsesCompleted: 18,
          requestErrors: 0,
          degradedRate: 0.1,
        },
        productEntrypointCoverage: [
          { entrySource: 'native', totalTrackedEvents: 5 },
          { entrySource: 'knowledge_detail', totalTrackedEvents: 2 },
        ],
      },
    },
    activationOverview: {
      data: {
        counts: {
          profileReadyUniqueCount: 10,
          aiQuestionUniqueCount: 6,
          knowledgeOpenUniqueCount: 4,
          valueActionUniqueCount: 8,
          activatedUniqueCount: 5,
          profileToActivationRate: 0.5,
          identityCoverageRate: 1,
        },
      },
    },
    ...overrides,
  };
}

describe('P6 data closure status report', () => {
  it('passes when funnel identity, payment, and AI data are healthy', () => {
    const report = buildP6DataClosureReport(baseInput());

    expect(report.status).toBe('pass');
    expect(report.canUseAsDailyReport).toBe(true);
    expect(report.canCloseP6).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.funnel.uniqueFirstStepCount).toBe(12);
    expect(report.funnel.uniquePaymentSuccessCount).toBe(3);
    expect(report.activation).toMatchObject({
      profileReadyUniqueCount: 10,
      activatedUniqueCount: 5,
      profileToActivationRate: 0.5,
    });
  });

  it('keeps P6 in attention when real data is sparse or provider health is degraded', () => {
    const report = buildP6DataClosureReport(baseInput({
      aiHealth: {
        data: {
          providerBlocks: [
            { provider: 'minimax', model: 'MiniMax-M2.7', reason: 'usage_limit' },
          ],
        },
      },
      funnel: {
        data: {
          rangeDays: 7,
          steps: [
            funnelStep('mini_program_app_download_click', 0, 0),
            funnelStep('app_payment_success', 0, 0),
          ],
          uniqueSteps: [
            funnelStep('mini_program_app_download_click', 0, 0, 5),
            funnelStep('app_payment_success', 0, 0),
          ],
          uniqueSummary: {
            firstStepUniqueCount: 0,
            totalIdentifiedEvents: 3,
            totalUnidentifiedEvents: 5,
            identityCoverageRate: 0.375,
          },
        },
      },
      aiOverview: {
        data: {
          serverAi: {
            requestsStarted: 8,
            responsesCompleted: 8,
            requestErrors: 0,
            degradedRate: 0.9,
          },
          productEntrypointCoverage: [],
        },
      },
      activationOverview: {
        data: {
          counts: {
            profileReadyUniqueCount: 2,
            aiQuestionUniqueCount: 0,
            knowledgeOpenUniqueCount: 0,
            valueActionUniqueCount: 0,
            activatedUniqueCount: 0,
            profileToActivationRate: 0,
            identityCoverageRate: 0.5,
          },
        },
      },
    }));

    expect(report.status).toBe('attention');
    expect(report.canUseAsDailyReport).toBe(true);
    expect(report.canCloseP6).toBe(false);
    expect(report.attention).toEqual(expect.arrayContaining([
      'funnel acquisition traffic is 0',
      'payment success traffic is 0',
      'analytics identity coverage is below 0.8: 0.3750',
      'AI degraded rate is 0.9000',
      'active AI provider blocks are present',
      'real product AI entrypoint traffic is 0',
      'activation completed user count is 0',
      'activation identity coverage is below 0.8: 0.5000',
    ]));
  });

  it('blocks when core health checks or funnel shape are invalid', () => {
    const report = buildP6DataClosureReport(baseInput({
      health: { status: 'ok', database: 'down' },
      funnel: { data: { rangeDays: 7, steps: [] } },
    }));

    expect(report.status).toBe('blocker');
    expect(report.canUseAsDailyReport).toBe(false);
    expect(report.canCloseP6).toBe(false);
    expect(report.blockers).toEqual(expect.arrayContaining([
      'primary health check is not ok',
      'analytics funnel uniqueSteps are missing',
    ]));
  });
});

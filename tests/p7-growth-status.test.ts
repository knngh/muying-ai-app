const {
  buildP7GrowthReport,
  buildP7GrowthMarkdown,
  parseP6HistoryLines,
} = require('../scripts/prod-p7-growth-status');

function baseP6Report(overrides = {}) {
  return {
    generatedAt: '2026-05-15T10:00:00.000Z',
    rangeDays: 7,
    status: 'attention',
    canUseAsDailyReport: true,
    canCloseP6Engineering: true,
    canCloseP6: false,
    blockers: [],
    attention: [
      'funnel acquisition traffic is 0',
      'payment success traffic is 0',
      'AI degraded rate is 0.9608',
    ],
    funnel: {
      uniqueFirstStepCount: 0,
      uniquePaymentSuccessCount: 0,
      identityCoverageRate: 1,
    },
    ai: {
      requestsStarted: 51,
      degradedRate: 0.9608,
      productEntrypointEvents: 13,
      coveredProductEntrypoints: ['native'],
    },
    activation: {
      profileReadyUniqueCount: 2,
      activatedUniqueCount: 1,
      profileToActivationRate: 0.5,
    },
    retention: {
      cohortUserCount: 3,
      d1RetentionRate: 0.25,
      d7RetentionRate: 0,
      retentionBehaviorEventCount: 2,
    },
    ...overrides,
  };
}

function baseAttributionQuality(overrides = {}) {
  return {
    acquisitionEventCount: 3,
    acquisitionUniqueCount: 2,
    requiredDimensions: ['channel', 'campaign', 'scene', 'entrySource'],
    dimensions: [
      {
        dimension: 'channel',
        attributedEventCount: 3,
        missingEventCount: 0,
        eventCoverageRate: 1,
        attributedUniqueCount: 2,
        uniqueCoverageRate: 1,
      },
      {
        dimension: 'campaign',
        attributedEventCount: 3,
        missingEventCount: 0,
        eventCoverageRate: 1,
        attributedUniqueCount: 2,
        uniqueCoverageRate: 1,
      },
      {
        dimension: 'scene',
        attributedEventCount: 3,
        missingEventCount: 0,
        eventCoverageRate: 1,
        attributedUniqueCount: 2,
        uniqueCoverageRate: 1,
      },
      {
        dimension: 'entrySource',
        attributedEventCount: 3,
        missingEventCount: 0,
        eventCoverageRate: 1,
        attributedUniqueCount: 2,
        uniqueCoverageRate: 1,
      },
    ],
    ...overrides,
  };
}

function baseAcquisitionOverview(overrides = {}) {
  return {
    data: {
      rangeDays: 7,
      summary: {
        acquisitionEventCount: 3,
        acquisitionUniqueCount: 2,
        activatedUniqueCount: 1,
        orderCreatedUniqueCount: 1,
        paymentSuccessUniqueCount: 0,
        retentionBehaviorUniqueCount: 1,
        identityCoverageRate: 0.875,
        ignoredOpsEventCount: 1,
        acquisitionToActivationRate: 0.5,
        acquisitionToOrderRate: 0.5,
        acquisitionToPaymentRate: 0,
        acquisitionToRetentionBehaviorRate: 0.5,
      },
      breakdown: {
        byChannel: [
          {
            key: 'xiaohongshu',
            acquisitionUniqueCount: 1,
            activatedUniqueCount: 1,
            paymentSuccessUniqueCount: 0,
            acquisitionToActivationRate: 1,
            acquisitionToPaymentRate: 0,
          },
        ],
      },
      attributionQuality: baseAttributionQuality(),
      topAcquisitionSegments: [
        {
          channel: 'xiaohongshu',
          campaign: 'newborn-fever',
          scene: 'knowledge_detail_download_card',
          entrySource: 'knowledge_detail',
          acquisitionUniqueCount: 1,
          activatedUniqueCount: 1,
          paymentSuccessUniqueCount: 0,
          acquisitionToActivationRate: 1,
          acquisitionToPaymentRate: 0,
        },
      ],
    },
    ...overrides,
  };
}

function historyRecord(overrides = {}) {
  return {
    generatedAt: '2026-05-15T00:00:00.000Z',
    status: 'attention',
    canUseAsDailyReport: true,
    canCloseP6: false,
    blockersCount: 0,
    attentionCount: 3,
    funnel: {
      uniqueFirstStepCount: 1,
      uniquePaymentSuccessCount: 0,
      identityCoverageRate: 1,
    },
    ai: {
      requestsStarted: 20,
      degradedRate: 0.9,
      productEntrypointEvents: 10,
    },
    activation: {
      profileReadyUniqueCount: 1,
      activatedUniqueCount: 1,
      profileToActivationRate: 1,
    },
    retention: {
      cohortUserCount: 1,
      d1RetentionRate: 0,
      d7RetentionRate: null,
      retentionBehaviorEventCount: 0,
    },
    ...overrides,
  };
}

describe('P7 growth status report', () => {
  it('parses JSONL history and skips malformed lines', () => {
    const records = parseP6HistoryLines([
      JSON.stringify(historyRecord({ generatedAt: '2026-05-14T00:00:00.000Z' })),
      'not-json',
      '',
      JSON.stringify(historyRecord({ generatedAt: '2026-05-15T00:00:00.000Z' })),
    ].join('\n'));

    expect(records).toHaveLength(2);
    expect(records.map((record: { generatedAt: string }) => record.generatedAt)).toEqual([
      '2026-05-14T00:00:00.000Z',
      '2026-05-15T00:00:00.000Z',
    ]);
  });

  it('keeps P7 in observe state when engineering is ready but operational traffic is sparse', () => {
    const report = buildP7GrowthReport({
      generatedAt: '2026-05-15T12:00:00.000Z',
      rangeDays: 7,
      p6Report: baseP6Report(),
      acquisitionOverview: baseAcquisitionOverview(),
      p6HistoryRecords: [
        historyRecord({ generatedAt: '2026-05-13T00:00:00.000Z', funnel: { uniqueFirstStepCount: 0, uniquePaymentSuccessCount: 0, identityCoverageRate: 1 } }),
        historyRecord({ generatedAt: '2026-05-14T00:00:00.000Z', funnel: { uniqueFirstStepCount: 1, uniquePaymentSuccessCount: 0, identityCoverageRate: 1 } }),
        historyRecord({ generatedAt: '2026-05-15T00:00:00.000Z', funnel: { uniqueFirstStepCount: 2, uniquePaymentSuccessCount: 0, identityCoverageRate: 1 } }),
      ],
    });

    expect(report.status).toBe('observe');
    expect(report.canUseAsP7DailyReport).toBe(true);
    expect(report.canCloseP7Engineering).toBe(true);
    expect(report.canCloseP7).toBe(false);
    expect(report.blockers).toEqual([]);
    expect(report.attention).toEqual(expect.arrayContaining([
      'P6 operational closure is still pending',
      'P7 payment success attribution is 0',
      'AI degraded rate is 0.9608',
    ]));
    expect(report.acquisition.summary).toMatchObject({
      acquisitionUniqueCount: 2,
      activatedUniqueCount: 1,
      paymentSuccessUniqueCount: 0,
      acquisitionToActivationRate: 0.5,
      acquisitionToPaymentRate: 0,
    });
    expect(report.trends).toMatchObject({
      historyRecordCount: 3,
      acquisitionTrend: {
        first: 0,
        latest: 2,
        delta: 2,
        direction: 'up',
      },
      paymentTrend: {
        first: 0,
        latest: 0,
        delta: 0,
        direction: 'flat',
      },
    });
    expect(report.nextActions).toContain('Keep P7 in operating observation until payment success appears from a real acquisition segment.');
  });

  it('passes when acquisition, activation, payment, AI and P6 current status are healthy', () => {
    const report = buildP7GrowthReport({
      generatedAt: '2026-05-15T12:00:00.000Z',
      rangeDays: 7,
      p6Report: baseP6Report({
        status: 'pass',
        canCloseP6: true,
        attention: [],
        funnel: {
          uniqueFirstStepCount: 10,
          uniquePaymentSuccessCount: 2,
          identityCoverageRate: 0.95,
        },
        ai: {
          requestsStarted: 40,
          degradedRate: 0.1,
          productEntrypointEvents: 18,
          coveredProductEntrypoints: ['native', 'knowledge_detail'],
        },
      }),
      acquisitionOverview: baseAcquisitionOverview({
        data: {
          ...baseAcquisitionOverview().data,
          summary: {
            acquisitionEventCount: 12,
            acquisitionUniqueCount: 10,
            activatedUniqueCount: 5,
            orderCreatedUniqueCount: 3,
            paymentSuccessUniqueCount: 2,
            retentionBehaviorUniqueCount: 3,
            identityCoverageRate: 0.95,
            ignoredOpsEventCount: 1,
            acquisitionToActivationRate: 0.5,
            acquisitionToOrderRate: 0.3,
            acquisitionToPaymentRate: 0.2,
            acquisitionToRetentionBehaviorRate: 0.3,
          },
        },
      }),
      p6HistoryRecords: [
        historyRecord({ funnel: { uniqueFirstStepCount: 5, uniquePaymentSuccessCount: 1, identityCoverageRate: 0.95 }, ai: { requestsStarted: 30, degradedRate: 0.2, productEntrypointEvents: 12 } }),
        historyRecord({ generatedAt: '2026-05-15T00:00:00.000Z', funnel: { uniqueFirstStepCount: 10, uniquePaymentSuccessCount: 2, identityCoverageRate: 0.95 }, ai: { requestsStarted: 40, degradedRate: 0.1, productEntrypointEvents: 18 } }),
      ],
    });

    expect(report.status).toBe('pass');
    expect(report.canUseAsP7DailyReport).toBe(true);
    expect(report.canCloseP7Engineering).toBe(true);
    expect(report.canCloseP7).toBe(true);
    expect(report.attention).toEqual([]);
    expect(report.nextActions).toContain('P7 growth observation can move from engineering closure to routine operations.');
  });

  it('keeps P7 in observe when entrySource attribution coverage falls below threshold', () => {
    const report = buildP7GrowthReport({
      generatedAt: '2026-05-15T12:00:00.000Z',
      rangeDays: 7,
      p6Report: baseP6Report({
        status: 'pass',
        canCloseP6: true,
        attention: [],
        funnel: {
          uniqueFirstStepCount: 10,
          uniquePaymentSuccessCount: 2,
          identityCoverageRate: 0.95,
        },
        ai: {
          requestsStarted: 40,
          degradedRate: 0.1,
          productEntrypointEvents: 18,
          coveredProductEntrypoints: ['native', 'knowledge_detail'],
        },
      }),
      acquisitionOverview: baseAcquisitionOverview({
        data: {
          ...baseAcquisitionOverview().data,
          summary: {
            acquisitionEventCount: 12,
            acquisitionUniqueCount: 10,
            activatedUniqueCount: 5,
            orderCreatedUniqueCount: 3,
            paymentSuccessUniqueCount: 2,
            retentionBehaviorUniqueCount: 3,
            identityCoverageRate: 0.95,
            ignoredOpsEventCount: 1,
            acquisitionToActivationRate: 0.5,
            acquisitionToOrderRate: 0.3,
            acquisitionToPaymentRate: 0.2,
            acquisitionToRetentionBehaviorRate: 0.3,
          },
          attributionQuality: baseAttributionQuality({
            acquisitionEventCount: 12,
            acquisitionUniqueCount: 10,
            dimensions: [
              {
                dimension: 'channel',
                attributedEventCount: 12,
                missingEventCount: 0,
                eventCoverageRate: 1,
                attributedUniqueCount: 10,
                uniqueCoverageRate: 1,
              },
              {
                dimension: 'campaign',
                attributedEventCount: 12,
                missingEventCount: 0,
                eventCoverageRate: 1,
                attributedUniqueCount: 10,
                uniqueCoverageRate: 1,
              },
              {
                dimension: 'scene',
                attributedEventCount: 12,
                missingEventCount: 0,
                eventCoverageRate: 1,
                attributedUniqueCount: 10,
                uniqueCoverageRate: 1,
              },
              {
                dimension: 'entrySource',
                attributedEventCount: 10,
                missingEventCount: 2,
                eventCoverageRate: 0.8333,
                attributedUniqueCount: 8,
                uniqueCoverageRate: 0.8,
              },
            ],
          }),
        },
      }),
      p6HistoryRecords: [
        historyRecord({ funnel: { uniqueFirstStepCount: 5, uniquePaymentSuccessCount: 1, identityCoverageRate: 0.95 }, ai: { requestsStarted: 30, degradedRate: 0.2, productEntrypointEvents: 12 } }),
        historyRecord({ generatedAt: '2026-05-15T00:00:00.000Z', funnel: { uniqueFirstStepCount: 10, uniquePaymentSuccessCount: 2, identityCoverageRate: 0.95 }, ai: { requestsStarted: 40, degradedRate: 0.1, productEntrypointEvents: 18 } }),
      ],
    });

    expect(report.status).toBe('observe');
    expect(report.canCloseP7Engineering).toBe(true);
    expect(report.canCloseP7).toBe(false);
    expect(report.attention).toEqual(expect.arrayContaining([
      'P7 attribution coverage for entrySource is below threshold: 0.8333',
    ]));
    expect(report.nextActions).toContain('Audit the mini-program acquisition query builders and share payloads to keep channel, campaign, scene and entrySource on the same link.');
    expect(report.acquisition.attributionQuality.dimensions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        dimension: 'entrySource',
        eventCoverageRate: 0.8333,
        missingEventCount: 2,
      }),
    ]));
  });

  it('blocks when P6 report is unusable or acquisition overview is missing', () => {
    const report = buildP7GrowthReport({
      generatedAt: '2026-05-15T12:00:00.000Z',
      rangeDays: 7,
      p6Report: baseP6Report({
        canUseAsDailyReport: false,
        canCloseP6Engineering: false,
        blockers: ['primary health check is not ok'],
      }),
      acquisitionOverview: {},
      p6HistoryRecords: [],
    });

    expect(report.status).toBe('blocker');
    expect(report.canUseAsP7DailyReport).toBe(false);
    expect(report.canCloseP7Engineering).toBe(false);
    expect(report.blockers).toEqual(expect.arrayContaining([
      'P6 daily report is not usable',
      'P7 acquisition overview summary is missing',
    ]));
  });

  it('builds a Markdown summary for运营周报', () => {
    const report = buildP7GrowthReport({
      generatedAt: '2026-05-15T12:00:00.000Z',
      rangeDays: 7,
      p6Report: baseP6Report(),
      acquisitionOverview: baseAcquisitionOverview(),
      p6HistoryRecords: [historyRecord()],
    });
    const markdown = buildP7GrowthMarkdown(report);

    expect(markdown).toContain('# P7 Growth Operations Summary');
    expect(markdown).toContain('- Status: `observe`');
    expect(markdown).toContain('| Acquisition |');
    expect(markdown).toContain('xiaohongshu');
    expect(markdown).toContain('P7 payment success attribution is 0');
  });
});

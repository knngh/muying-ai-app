const { buildP5GrayReport } = require('../scripts/prod-p5-gray-status');

const okCommand = {
  name: 'main_smoke',
  command: 'npm run ops:smoke:prod',
  enabled: true,
  exitCode: 0,
  durationMs: 100,
};

function baseInput(overrides = {}) {
  return {
    generatedAt: '2026-05-14T10:00:00.000Z',
    rangeDays: 7,
    commands: [okCommand],
    health: { status: 'ok', database: 'ok' },
    legacyHealth: { status: 'ok', database: 'ok' },
    freeSubscription: { data: { status: 'free', aiLimit: 3, remainingToday: 3 } },
    vipSubscription: { data: { status: 'active', currentPlanCode: 'quarterly', aiLimit: 9999, remainingToday: 9999 } },
    aiOverview: {
      data: {
        serverAi: {
          requestsStarted: 14,
          responsesCompleted: 14,
          requestErrors: 0,
          degradedRate: 0.1,
          realEntrySourceEventCount: 1,
        },
        productEntrypointCoverage: [
          { entrySource: 'native', totalTrackedEvents: 3 },
        ],
        opsProductEntrypointCoverage: [
          { entrySource: 'native', totalTrackedEvents: 4 },
        ],
      },
    },
    funnel: { data: { rangeDays: 7, steps: [] } },
    ...overrides,
  };
}

describe('P5 gray status report', () => {
  it('passes when smoke commands and real traffic checks are healthy', () => {
    const report = buildP5GrayReport(baseInput());

    expect(report.status).toBe('pass');
    expect(report.canEnterGray).toBe(true);
    expect(report.canCloseP5).toBe(true);
    expect(report.blockers).toEqual([]);
  });

  it('keeps P5 in attention when real AI entrypoint traffic is absent', () => {
    const report = buildP5GrayReport(baseInput({
      aiOverview: {
        data: {
          serverAi: {
            requestsStarted: 14,
            responsesCompleted: 14,
            requestErrors: 0,
            degradedRate: 0.1,
            realEntrySourceEventCount: 0,
          },
          productEntrypointCoverage: [
            { entrySource: 'native', totalTrackedEvents: 0 },
          ],
          opsProductEntrypointCoverage: [
            { entrySource: 'native', totalTrackedEvents: 4 },
          ],
        },
      },
    }));

    expect(report.status).toBe('attention');
    expect(report.canEnterGray).toBe(true);
    expect(report.canCloseP5).toBe(false);
    expect(report.attention).toContain('real user AI entrypoint traffic is still 0');
  });

  it('uses product entrypoint coverage when server real-entry aggregation is conservative', () => {
    const report = buildP5GrayReport(baseInput({
      aiOverview: {
        data: {
          serverAi: {
            requestsStarted: 14,
            responsesCompleted: 14,
            requestErrors: 0,
            degradedRate: 0.1,
            realEntrySourceEventCount: 0,
          },
          productEntrypointCoverage: [
            {
              entrySource: 'native',
              totalTrackedEvents: 0,
              clickCount: 1,
              messageCount: 1,
              serverStartCount: 1,
              serverResponseCount: 1,
            },
          ],
          opsProductEntrypointCoverage: [
            { entrySource: 'native', totalTrackedEvents: 4 },
          ],
        },
      },
    }));

    expect(report.status).toBe('pass');
    expect(report.canCloseP5).toBe(true);
    expect(report.attention).not.toContain('real user AI entrypoint traffic is still 0');
    expect(report.ai.productEntrypointEvents).toBe(4);
  });

  it('blocks rollout when a required smoke command fails', () => {
    const report = buildP5GrayReport(baseInput({
      commands: [
        okCommand,
        {
          name: 'ai_websocket_smoke',
          command: 'npm run ops:smoke:ai:ws',
          enabled: true,
          exitCode: 1,
          durationMs: 100,
        },
      ],
    }));

    expect(report.status).toBe('blocker');
    expect(report.canEnterGray).toBe(false);
    expect(report.blockers).toEqual(expect.arrayContaining([
      'ai_websocket_smoke failed with exit code 1',
    ]));
  });
});

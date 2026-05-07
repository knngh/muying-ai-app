import { buildKnowledgeDailyOpsReport } from '../src/utils/knowledge-daily-ops';

describe('knowledge daily ops report', () => {
  it('marks report as attention when coverage and source dry-run need follow-up', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-07T00:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'coverage', command: 'npm run audit:authority-coverage', ok: true, exitCode: 0, durationMs: 100 },
      ],
      knowledgeReport: {
        coverage: {
          coverageRate: 52.83,
          authorityCovered: 1659,
          missingAuthorityCoverage: 1481,
        },
        sourceCoverage: {
          watchedSources: [
            { sourceId: 'mayo-clinic-zh', count: 0, minimumPublishedRecords: 10, status: 'missing' },
          ],
        },
        actionItems: [
          { priority: 'P2', area: 'source_coverage', message: 'mayo-clinic-zh has 0/10 published authority records' },
        ],
      },
      sourceRefreshResult: {
        dryRun: true,
        selectedSources: [
          { sourceId: 'mayo-clinic-zh', count: 0, minimumPublishedRecords: 10, status: 'missing' },
        ],
      },
    });

    expect(report.status).toBe('attention');
    expect(report.nextActions).toEqual(expect.arrayContaining([
      'Authority coverage is below P2 target: 52.83% < 60%',
      'Review low-coverage source dry-run output, then run KNOWLEDGE_DAILY_APPLY_FIXES=true npm run ops:knowledge:daily when ready.',
    ]));
  });

  it('marks report as failed when a command fails', () => {
    const report = buildKnowledgeDailyOpsReport({
      generatedAt: '2026-05-07T00:00:00.000Z',
      applyFixes: false,
      commands: [
        { name: 'coverage', command: 'npm run audit:authority-coverage', ok: false, exitCode: 1, durationMs: 100, stderrTail: 'boom' },
      ],
    });

    expect(report.status).toBe('failed');
    expect(report.nextActions[0]).toBe('Inspect failed daily ops command(s): coverage');
  });
});

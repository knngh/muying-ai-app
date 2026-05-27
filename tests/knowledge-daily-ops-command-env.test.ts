import {
  buildKnowledgeOpsReportCommandEnv,
  buildLowCoverageSourceRefreshCommandEnv,
} from '../src/utils/knowledge-daily-ops-command-env';

describe('knowledge daily ops command env', () => {
  it('makes ops report read the same coverage audit file that daily just generated', () => {
    expect(buildKnowledgeOpsReportCommandEnv({
      dailyCoverageAuditFile: '/tmp/daily-coverage.json',
      knowledgeReportFile: '/tmp/knowledge-report.json',
    })).toEqual({
      COVERAGE_AUDIT_FILE: '/tmp/daily-coverage.json',
      OUTPUT_FILE: '/tmp/knowledge-report.json',
    });
  });

  it('forwards watched source coverage settings into ops report generation', () => {
    expect(buildKnowledgeOpsReportCommandEnv({
      dailyCoverageAuditFile: '/tmp/daily-coverage.json',
      knowledgeReportFile: '/tmp/knowledge-report.json',
      watchedSourceIds: 'nhc-fys,chinacdc-nutrition',
      watchedSourceMinimumRecords: '20',
    })).toEqual({
      COVERAGE_AUDIT_FILE: '/tmp/daily-coverage.json',
      OUTPUT_FILE: '/tmp/knowledge-report.json',
      WATCHED_SOURCE_IDS: 'nhc-fys,chinacdc-nutrition',
      WATCHED_SOURCE_MINIMUM_RECORDS: '20',
    });
  });

  it('raises the default low coverage refresh breadth while keeping dry-run safe', () => {
    expect(buildLowCoverageSourceRefreshCommandEnv({
      applyFixes: false,
      outputFile: '/tmp/refresh.json',
    })).toEqual({
      DRY_RUN: 'true',
      AUTHORITY_SOURCE_DRY_RUN_PROBE_DISCOVERY: 'true',
      AUTHORITY_SOURCE_DRY_RUN_SAMPLE_LIMIT: '10',
      AUTHORITY_SOURCE_LIMIT: '12',
      AUTHORITY_SOURCE_MIN_DISCOVERY_CANDIDATES: '3',
      OUTPUT_FILE: '/tmp/refresh.json',
    });
  });

  it('keeps explicit low coverage refresh limits and disables dry-run only for apply runs', () => {
    expect(buildLowCoverageSourceRefreshCommandEnv({
      applyFixes: true,
      outputFile: '/tmp/refresh.json',
      authoritySourceDryRunSampleLimit: '4',
      authoritySourceLimit: '2',
      authoritySourceMinDiscoveryCandidates: '5',
    })).toEqual({
      DRY_RUN: 'false',
      AUTHORITY_SOURCE_DRY_RUN_SAMPLE_LIMIT: '4',
      AUTHORITY_SOURCE_LIMIT: '2',
      AUTHORITY_SOURCE_MIN_DISCOVERY_CANDIDATES: '5',
      OUTPUT_FILE: '/tmp/refresh.json',
    });
  });
});

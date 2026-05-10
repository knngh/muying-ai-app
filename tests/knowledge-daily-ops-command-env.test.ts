import { buildKnowledgeOpsReportCommandEnv } from '../src/utils/knowledge-daily-ops-command-env';

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
});

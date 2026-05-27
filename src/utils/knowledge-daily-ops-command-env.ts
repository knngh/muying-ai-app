import { DEFAULT_AUTHORITY_SOURCE_MIN_DISCOVERY_CANDIDATES } from './authority-source-refresh';

export const DEFAULT_LOW_COVERAGE_SOURCE_LIMIT = '12';
export const DEFAULT_LOW_COVERAGE_DRY_RUN_SAMPLE_LIMIT = '10';
export const DEFAULT_LOW_COVERAGE_MIN_DISCOVERY_CANDIDATES = String(DEFAULT_AUTHORITY_SOURCE_MIN_DISCOVERY_CANDIDATES);

export function buildKnowledgeOpsReportCommandEnv(input: {
  dailyCoverageAuditFile: string;
  knowledgeReportFile: string;
  watchedSourceIds?: string;
  watchedSourceMinimumRecords?: string;
}): Record<string, string> {
  const env: Record<string, string> = {
    COVERAGE_AUDIT_FILE: input.dailyCoverageAuditFile,
    OUTPUT_FILE: input.knowledgeReportFile,
  };

  if (input.watchedSourceIds) {
    env.WATCHED_SOURCE_IDS = input.watchedSourceIds;
  }
  if (input.watchedSourceMinimumRecords) {
    env.WATCHED_SOURCE_MINIMUM_RECORDS = input.watchedSourceMinimumRecords;
  }

  return env;
}

export function buildLowCoverageSourceRefreshCommandEnv(input: {
  applyFixes: boolean;
  outputFile: string;
  authoritySourceDryRunSampleLimit?: string;
  authoritySourceLimit?: string;
  authoritySourceMinDiscoveryCandidates?: string;
}): Record<string, string> {
  const env: Record<string, string> = {
    DRY_RUN: input.applyFixes ? 'false' : 'true',
    AUTHORITY_SOURCE_DRY_RUN_SAMPLE_LIMIT: input.authoritySourceDryRunSampleLimit || DEFAULT_LOW_COVERAGE_DRY_RUN_SAMPLE_LIMIT,
    AUTHORITY_SOURCE_LIMIT: input.authoritySourceLimit || DEFAULT_LOW_COVERAGE_SOURCE_LIMIT,
    AUTHORITY_SOURCE_MIN_DISCOVERY_CANDIDATES: input.authoritySourceMinDiscoveryCandidates || DEFAULT_LOW_COVERAGE_MIN_DISCOVERY_CANDIDATES,
    OUTPUT_FILE: input.outputFile,
  };

  if (!input.applyFixes) {
    env.AUTHORITY_SOURCE_DRY_RUN_PROBE_DISCOVERY = 'true';
  }

  return env;
}

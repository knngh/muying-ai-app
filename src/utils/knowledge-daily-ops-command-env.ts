export function buildKnowledgeOpsReportCommandEnv(input: {
  dailyCoverageAuditFile: string;
  knowledgeReportFile: string;
}): Record<string, string> {
  return {
    COVERAGE_AUDIT_FILE: input.dailyCoverageAuditFile,
    OUTPUT_FILE: input.knowledgeReportFile,
  };
}

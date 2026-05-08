export interface KnowledgeDailyOpsCommandResult {
  name: string;
  command: string;
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
  skipped?: boolean;
  error?: string;
  stdoutTail?: string;
  stderrTail?: string;
}

export interface KnowledgeDailyOpsKnowledgeReport {
  coverage?: {
    coverageRate?: number;
    authorityCovered?: number;
    missingAuthorityCoverage?: number;
  };
  translations?: {
    recordsForTranslation?: number;
    cacheEntries?: number;
    invalidCacheEntries?: number;
    missingFreshTranslations?: number;
    failureEntries?: number;
    retryableFailures?: number;
    blockedFailures?: number;
    cacheHitRate?: number;
  };
  sourceCoverage?: {
    watchedSources?: Array<{
      sourceId?: string;
      count?: number;
      minimumPublishedRecords?: number;
      status?: string;
    }>;
  };
  actionItems?: Array<{ priority?: string; area?: string; message?: string }>;
}

export interface KnowledgeDailyOpsSourceRefreshResult {
  dryRun?: boolean;
  selectedSources?: Array<{
    sourceId?: string;
    count?: number;
    minimumPublishedRecords?: number;
    status?: string;
  }>;
  summaries?: Array<{
    sourceId?: string;
    skipped?: boolean;
    reason?: string;
    discoveryProbe?: {
      ok?: boolean;
      discovered?: number;
      sampleUrls?: string[];
      entryDiagnostics?: Array<{
        entryUrl?: string;
        ok?: boolean;
        status?: number | null;
        contentType?: string | null;
        locCount?: number;
        nestedSitemapCount?: number;
        matchedCandidateCount?: number;
        sampleMatchedUrls?: string[];
        error?: string;
      }>;
      error?: string;
    };
  }>;
}

export interface KnowledgeDailyOpsTranslationCleanupReport {
  dryRun?: boolean;
  total?: number;
  kept?: number;
  removed?: number;
}

export interface BuildKnowledgeDailyOpsReportInput {
  generatedAt: string;
  applyFixes: boolean;
  commands: KnowledgeDailyOpsCommandResult[];
  knowledgeReport?: KnowledgeDailyOpsKnowledgeReport | null;
  sourceRefreshResult?: KnowledgeDailyOpsSourceRefreshResult | null;
  translationCleanupReport?: KnowledgeDailyOpsTranslationCleanupReport | null;
}

function buildNextActions(input: BuildKnowledgeDailyOpsReportInput): string[] {
  const actions: string[] = [];
  const failedCommands = input.commands.filter((command) => !command.ok && !command.skipped);
  const sourceRefreshCount = input.sourceRefreshResult?.selectedSources?.length || 0;
  const removedTranslations = input.translationCleanupReport?.removed || 0;
  const coverageRate = input.knowledgeReport?.coverage?.coverageRate ?? 100;

  if (failedCommands.length > 0) {
    actions.push(`Inspect failed daily ops command(s): ${failedCommands.map((command) => command.name).join(', ')}`);
  }
  if (coverageRate < 60) {
    actions.push(`Authority coverage is below P2 target: ${coverageRate}% < 60%`);
  }
  if (sourceRefreshCount > 0 && input.sourceRefreshResult?.dryRun !== false) {
    actions.push('Review low-coverage source dry-run output, then run KNOWLEDGE_DAILY_APPLY_FIXES=true npm run ops:knowledge:daily when ready.');
  }
  for (const summary of input.sourceRefreshResult?.summaries || []) {
    const sourceId = summary.sourceId || 'unknown-source';
    const probe = summary.discoveryProbe;
    if (!probe) {
      continue;
    }

    const blockedEntry = (probe.entryDiagnostics || []).find((entry) => entry.ok === false && entry.status);
    if (blockedEntry?.entryUrl) {
      actions.push(`${sourceId} discovery entry is blocked upstream (${blockedEntry.status}): ${blockedEntry.entryUrl}`);
      continue;
    }

    if (Number(probe.discovered || 0) > 0) {
      actions.push(`${sourceId} discovery probe found ${probe.discovered} candidate URL(s); safe to run a controlled source refresh for that source.`);
    }
  }
  if (removedTranslations > 0 && input.translationCleanupReport?.dryRun !== false) {
    actions.push('Run DRY_RUN=false npm run clean:authority-translation-cache to remove invalid cached translations.');
  }

  return actions;
}

function summarizeKnowledgeReport(report?: KnowledgeDailyOpsKnowledgeReport | null) {
  return {
    coverage: report?.coverage
      ? {
        coverageRate: report.coverage.coverageRate,
        authorityCovered: report.coverage.authorityCovered,
        missingAuthorityCoverage: report.coverage.missingAuthorityCoverage,
      }
      : null,
    translations: report?.translations
      ? {
        recordsForTranslation: report.translations.recordsForTranslation,
        cacheEntries: report.translations.cacheEntries,
        invalidCacheEntries: report.translations.invalidCacheEntries,
        missingFreshTranslations: report.translations.missingFreshTranslations,
        failureEntries: report.translations.failureEntries,
        retryableFailures: report.translations.retryableFailures,
        blockedFailures: report.translations.blockedFailures,
        cacheHitRate: report.translations.cacheHitRate,
      }
      : null,
    sourceCoverage: report?.sourceCoverage
      ? {
        watchedSources: report.sourceCoverage.watchedSources || [],
      }
      : null,
    actionItems: report?.actionItems || [],
  };
}

export function buildKnowledgeDailyOpsReport(input: BuildKnowledgeDailyOpsReportInput) {
  const failedCommands = input.commands.filter((command) => !command.ok && !command.skipped);
  const knowledgeSummary = summarizeKnowledgeReport(input.knowledgeReport);
  const actionItems = knowledgeSummary.actionItems;
  const nextActions = buildNextActions(input);
  const status = failedCommands.length > 0
    ? 'failed'
    : actionItems.length > 0 || nextActions.length > 0
      ? 'attention'
      : 'ok';

  return {
    generatedAt: input.generatedAt,
    status,
    applyFixes: input.applyFixes,
    commands: {
      total: input.commands.length,
      failed: failedCommands.length,
      results: input.commands,
    },
    knowledge: knowledgeSummary,
    remediation: {
      sourceRefresh: {
        dryRun: input.sourceRefreshResult?.dryRun ?? true,
        selectedSources: input.sourceRefreshResult?.selectedSources || [],
        summaries: input.sourceRefreshResult?.summaries || [],
      },
      translationCleanup: input.translationCleanupReport || null,
    },
    nextActions,
  };
}

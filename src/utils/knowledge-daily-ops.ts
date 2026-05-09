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
  promotion?: {
    safeQuestionCandidates?: {
      eligibleInput?: number;
      total?: number;
      byCategory?: Array<{ key?: string; count?: number }>;
      byTopic?: Array<{ key?: string; count?: number }>;
      excluded?: Record<string, number>;
      candidates?: Array<{
        id?: string;
        question?: string;
        category?: string;
        topic?: string;
        riskLevel?: string;
        suggestedUse?: string;
      }>;
    };
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
        paginationCandidateCount?: number;
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

export interface KnowledgeDailyOpsTranslationFailureRetryReport {
  dryRun?: boolean;
  totalFailures?: number;
  retryableFailures?: number;
  blockedFailures?: number;
  limit?: number;
  selectedFailures?: Array<{
    slug?: string;
    message?: string;
    attempts?: number;
    retryAfterAt?: string;
    retryable?: boolean;
    blockedReason?: string;
  }>;
  retried?: Array<{
    slug?: string;
    ok?: boolean;
    message?: string;
    cleared?: boolean;
  }>;
  retrySucceeded?: number;
  retryFailed?: number;
}

export interface BuildKnowledgeDailyOpsReportInput {
  generatedAt: string;
  applyFixes: boolean;
  commands: KnowledgeDailyOpsCommandResult[];
  knowledgeReport?: KnowledgeDailyOpsKnowledgeReport | null;
  sourceRefreshResult?: KnowledgeDailyOpsSourceRefreshResult | null;
  translationCleanupReport?: KnowledgeDailyOpsTranslationCleanupReport | null;
  translationFailureRetryReport?: KnowledgeDailyOpsTranslationFailureRetryReport | null;
}

function resolveBlockedExternalSources(input: BuildKnowledgeDailyOpsReportInput): Array<{
  sourceId: string;
  blockedEntryUrl?: string;
  blockedStatus?: number | null;
}> {
  const blockedSources: Array<{ sourceId: string; blockedEntryUrl?: string; blockedStatus?: number | null }> = [];

  for (const summary of input.sourceRefreshResult?.summaries || []) {
    const sourceId = summary.sourceId;
    if (!sourceId) {
      continue;
    }

    const probe = summary.discoveryProbe;
    if (!probe || Number(probe.discovered || 0) > 0) {
      continue;
    }

    const blockedEntry = (probe.entryDiagnostics || []).find((entry) => entry.ok === false && entry.status);
    if (!blockedEntry) {
      continue;
    }

    blockedSources.push({
      sourceId,
      blockedEntryUrl: blockedEntry.entryUrl,
      blockedStatus: blockedEntry.status,
    });
  }

  return blockedSources;
}

function filterActionItemsForBlockedExternalSources(
  actionItems: Array<{ priority?: string; area?: string; message?: string }>,
  blockedExternalSources: Array<{ sourceId: string }>,
): Array<{ priority?: string; area?: string; message?: string }> {
  const blockedSourceIds = new Set(blockedExternalSources.map((source) => source.sourceId));
  if (blockedSourceIds.size === 0) {
    return actionItems;
  }

  return actionItems.filter((item) => {
    if (item.area !== 'source_coverage') {
      return true;
    }

    return !Array.from(blockedSourceIds).some((sourceId) => item.message?.includes(sourceId));
  });
}

function buildNextActions(input: BuildKnowledgeDailyOpsReportInput): string[] {
  const actions: string[] = [];
  const failedCommands = input.commands.filter((command) => !command.ok && !command.skipped);
  const removedTranslations = input.translationCleanupReport?.removed || 0;
  const retryableTranslationFailures = input.translationFailureRetryReport?.retryableFailures || 0;
  const selectedTranslationFailures = input.translationFailureRetryReport?.selectedFailures?.length || 0;
  const coverageRate = input.knowledgeReport?.coverage?.coverageRate ?? 100;
  const blockedExternalSources = resolveBlockedExternalSources(input);
  const blockedExternalSourceIds = new Set(blockedExternalSources.map((source) => source.sourceId));
  const refreshableSources = (input.sourceRefreshResult?.selectedSources || [])
    .filter((source) => source.sourceId && !blockedExternalSourceIds.has(source.sourceId));

  if (failedCommands.length > 0) {
    actions.push(`Inspect failed daily ops command(s): ${failedCommands.map((command) => command.name).join(', ')}`);
  }
  if (coverageRate < 60) {
    actions.push(`Authority coverage is below P2 target: ${coverageRate}% < 60%`);
  }
  if (refreshableSources.length > 0 && input.sourceRefreshResult?.dryRun !== false) {
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
      if (!blockedExternalSourceIds.has(sourceId)) {
        actions.push(`${sourceId} discovery entry is blocked upstream (${blockedEntry.status}): ${blockedEntry.entryUrl}`);
      }
      continue;
    }

    if (Number(probe.discovered || 0) > 0) {
      actions.push(`${sourceId} discovery probe found ${probe.discovered} candidate URL(s); safe to run a controlled source refresh for that source.`);
    }
  }
  if (removedTranslations > 0 && input.translationCleanupReport?.dryRun !== false) {
    actions.push('Run DRY_RUN=false npm run clean:authority-translation-cache to remove invalid cached translations.');
  }
  if (
    retryableTranslationFailures > 0
    && selectedTranslationFailures > 0
    && input.translationFailureRetryReport?.dryRun !== false
  ) {
    actions.push(`Run DRY_RUN=false npm run retry:authority-translation-failures to retry ${selectedTranslationFailures} translation failure(s).`);
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
    promotion: report?.promotion
      ? {
        safeQuestionCandidates: report.promotion.safeQuestionCandidates
          ? {
            eligibleInput: report.promotion.safeQuestionCandidates.eligibleInput,
            total: report.promotion.safeQuestionCandidates.total,
            byCategory: report.promotion.safeQuestionCandidates.byCategory || [],
            byTopic: report.promotion.safeQuestionCandidates.byTopic || [],
            excluded: report.promotion.safeQuestionCandidates.excluded || {},
            candidates: (report.promotion.safeQuestionCandidates.candidates || []).slice(0, 5),
          }
          : null,
      }
      : null,
    actionItems: report?.actionItems || [],
  };
}

export function buildKnowledgeDailyOpsReport(input: BuildKnowledgeDailyOpsReportInput) {
  const failedCommands = input.commands.filter((command) => !command.ok && !command.skipped);
  const knowledgeSummary = summarizeKnowledgeReport(input.knowledgeReport);
  const blockedExternalSources = resolveBlockedExternalSources(input);
  const actionItems = filterActionItemsForBlockedExternalSources(
    knowledgeSummary.actionItems,
    blockedExternalSources,
  );
  knowledgeSummary.actionItems = actionItems;
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
      translationFailureRetry: input.translationFailureRetryReport || null,
    },
    blockedExternalSources,
    nextActions,
  };
}

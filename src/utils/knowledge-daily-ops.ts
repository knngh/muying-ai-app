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
  actionableRetryableFailures?: number;
  staleRetryableFailures?: number;
  blockedFailures?: number;
  limit?: number;
  selectedFailures?: Array<{
    slug?: string;
    message?: string;
    attempts?: number;
    retryAfterAt?: string;
    retryable?: boolean;
    blockedReason?: string;
    skipReason?: string;
  }>;
  skippedFailures?: Array<{
    slug?: string;
    message?: string;
    attempts?: number;
    retryAfterAt?: string;
    retryable?: boolean;
    blockedReason?: string;
    skipReason?: string;
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

export interface KnowledgeDailyOpsAIProviderHealthReport {
  generatedAt?: string;
  status?: 'ok' | 'failed' | 'degraded' | string;
  taskRole?: string;
  timeoutMs?: number;
  maxTokens?: number;
  binding?: {
    role?: string;
    model?: string;
    provider?: string;
    configured?: boolean;
  } | null;
  call?: {
    attempted?: boolean;
    ok?: boolean;
    elapsedMs?: number;
    answerPreview?: string;
    expectedMatched?: boolean;
    route?: {
      provider?: string;
      model?: string;
      route?: string;
      label?: string;
    };
    error?: {
      message?: string;
      gatewayStatus?: number;
      gatewayProvider?: string;
      gatewayModel?: string;
    };
  };
}

export interface BuildKnowledgeDailyOpsReportInput {
  generatedAt: string;
  applyFixes: boolean;
  commands: KnowledgeDailyOpsCommandResult[];
  knowledgeReport?: KnowledgeDailyOpsKnowledgeReport | null;
  sourceRefreshResult?: KnowledgeDailyOpsSourceRefreshResult | null;
  translationCleanupReport?: KnowledgeDailyOpsTranslationCleanupReport | null;
  translationFailureRetryReport?: KnowledgeDailyOpsTranslationFailureRetryReport | null;
  aiProviderHealthReport?: KnowledgeDailyOpsAIProviderHealthReport | null;
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

    if (sourceId === 'mayo-clinic-zh' && summary.reason === 'preflight_failed') {
      blockedSources.push({ sourceId });
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

function filterActionItemsForBlockedTranslationFailures(
  actionItems: Array<{ priority?: string; area?: string; message?: string }>,
  translations?: KnowledgeDailyOpsKnowledgeReport['translations'],
): Array<{ priority?: string; area?: string; message?: string }> {
  if (!translations) {
    return actionItems;
  }

  const hasFailureBreakdown = Number.isFinite(translations.retryableFailures)
    && Number.isFinite(translations.blockedFailures);
  const retryableFailures = Number(translations.retryableFailures || 0);
  const blockedFailures = Number(translations.blockedFailures || 0);
  const failureEntries = Number(translations.failureEntries || 0);
  if (!hasFailureBreakdown || failureEntries === 0 || retryableFailures > 0 || blockedFailures < failureEntries) {
    return actionItems;
  }

  return actionItems.filter((item) => item.area !== 'translation_cache' || item.message?.includes('invalid translation cache'));
}

function isPrunableTranslationRetrySkip(skipReason?: string): boolean {
  return skipReason === 'authority_record_not_found' || skipReason === 'source_updated_at_mismatch';
}

function filterActionItemsForNonActionableTranslationFailures(
  actionItems: Array<{ priority?: string; area?: string; message?: string }>,
  retryReport?: KnowledgeDailyOpsTranslationFailureRetryReport | null,
): Array<{ priority?: string; area?: string; message?: string }> {
  if (!retryReport) {
    return actionItems;
  }

  const retryableFailures = Number(retryReport.retryableFailures || 0);
  if (retryableFailures <= 0) {
    return actionItems;
  }

  const selectedRetryableFailures = (retryReport.selectedFailures || [])
    .filter((candidate) => candidate.retryable).length;
  const actionableRetryableFailures = Number.isFinite(retryReport.actionableRetryableFailures)
    ? Number(retryReport.actionableRetryableFailures)
    : selectedRetryableFailures;
  if (actionableRetryableFailures > 0 || selectedRetryableFailures > 0) {
    return actionItems;
  }

  const retryableSkippedFailures = (retryReport.skippedFailures || [])
    .filter((candidate) => candidate.retryable);
  const staleRetryableFailures = Number.isFinite(retryReport.staleRetryableFailures)
    ? Number(retryReport.staleRetryableFailures)
    : retryableSkippedFailures.filter((candidate) => isPrunableTranslationRetrySkip(candidate.skipReason)).length;
  if (staleRetryableFailures < retryableFailures) {
    return actionItems;
  }

  return actionItems.filter((item) => {
    if (item.area !== 'translation_cache') {
      return true;
    }

    return Boolean(item.message?.includes('invalid translation cache'));
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
  const aiHealth = input.aiProviderHealthReport;

  if (failedCommands.length > 0) {
    actions.push(`Inspect failed daily ops command(s): ${failedCommands.map((command) => command.name).join(', ')}`);
  }
  if (aiHealth?.status === 'failed') {
    const provider = aiHealth.call?.route?.provider || aiHealth.binding?.provider || aiHealth.call?.error?.gatewayProvider || 'unknown-provider';
    const model = aiHealth.call?.route?.model || aiHealth.binding?.model || aiHealth.call?.error?.gatewayModel || 'unknown-model';
    actions.push(`AI provider health check failed for ${aiHealth.taskRole || 'unknown-role'} (${provider} / ${model}).`);
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
  const actionItemsWithoutBlockedTranslationFailures = filterActionItemsForBlockedTranslationFailures(
    knowledgeSummary.actionItems,
    knowledgeSummary.translations || undefined,
  );
  const actionItemsWithoutNonActionableTranslationFailures = filterActionItemsForNonActionableTranslationFailures(
    actionItemsWithoutBlockedTranslationFailures,
    input.translationFailureRetryReport,
  );
  const actionItems = filterActionItemsForBlockedExternalSources(
    actionItemsWithoutNonActionableTranslationFailures,
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
      aiProviderHealth: input.aiProviderHealthReport
        ? {
          generatedAt: input.aiProviderHealthReport.generatedAt,
          status: input.aiProviderHealthReport.status,
          taskRole: input.aiProviderHealthReport.taskRole,
          timeoutMs: input.aiProviderHealthReport.timeoutMs,
          maxTokens: input.aiProviderHealthReport.maxTokens,
          binding: input.aiProviderHealthReport.binding
            ? {
              role: input.aiProviderHealthReport.binding.role,
              provider: input.aiProviderHealthReport.binding.provider,
              model: input.aiProviderHealthReport.binding.model,
              configured: input.aiProviderHealthReport.binding.configured,
            }
            : null,
          call: input.aiProviderHealthReport.call
            ? {
              attempted: input.aiProviderHealthReport.call.attempted,
              ok: input.aiProviderHealthReport.call.ok,
              elapsedMs: input.aiProviderHealthReport.call.elapsedMs,
              answerPreview: input.aiProviderHealthReport.call.answerPreview,
              expectedMatched: input.aiProviderHealthReport.call.expectedMatched,
              route: input.aiProviderHealthReport.call.route,
              error: input.aiProviderHealthReport.call.error
                ? {
                  message: input.aiProviderHealthReport.call.error.message,
                  gatewayStatus: input.aiProviderHealthReport.call.error.gatewayStatus,
                  gatewayProvider: input.aiProviderHealthReport.call.error.gatewayProvider,
                  gatewayModel: input.aiProviderHealthReport.call.error.gatewayModel,
                }
                : undefined,
            }
            : undefined,
        }
        : null,
    },
    blockedExternalSources,
    nextActions,
  };
}

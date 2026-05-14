export type AIOpsReportStatus = 'ok' | 'attention';

export interface AIOpsActionItem {
  area: string;
  severity: 'medium' | 'high';
  message: string;
  metric?: number | null;
  threshold?: number;
}

export interface AIOpsReport {
  generatedAt: string;
  rangeDays: number;
  startAt?: string;
  endAt?: string;
  status: AIOpsReportStatus;
  clientAi: {
    messagesSent: number;
    responsesReceived: number;
    responseReceiveRate: number | null;
    degradedRate: number | null;
    withSourcesRate: number | null;
  };
  serverAi: {
    requestsStarted: number;
    responsesCompleted: number;
    requestErrors: number;
    completionRate: number | null;
    errorRate: number | null;
    averageLatencyMs: number | null;
    degradedRate: number | null;
    withSourcesRate: number | null;
    recommendedQuestionsServed: number;
    recommendedQuestionsReturned: number;
    topEndpoint: string | null;
    topProvider: string | null;
    topRoute: string | null;
    topErrorCode: string | null;
    topEntrySource: string | null;
    opsSmokeEventCount: number;
    opsEntrypointSmokeEventCount: number;
    nonOpsEntrySourceEventCount: number;
  };
  acquisition: {
    recommendedQuestionsServed: number;
    recommendedQuestionsReturned: number;
    topRecommendedStage: string | null;
    topRecommendedSource: string | null;
  };
  productEntrypointCoverage: ProductEntrypointCoverage[];
  opsProductEntrypointCoverage: ProductEntrypointCoverage[];
  actionItems: AIOpsActionItem[];
  nextActions: string[];
}

export interface AIOpsReportThresholds {
  minServerRequestsForRate?: number;
  maxServerErrorRate?: number;
  maxAverageLatencyMs?: number;
  maxServerDegradedRate?: number;
  minServerWithSourcesRate?: number;
  minClientWithSourcesRate?: number;
}

interface AIOpsOverviewInput {
  rangeDays?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  counts?: unknown;
  responseQuality?: unknown;
  productEntrypointCoverage?: unknown;
  opsProductEntrypointCoverage?: unknown;
  serverAi?: unknown;
}

export interface ProductEntrypointCoverage {
  entrySource: string;
  label: string;
  clickCount: number;
  prefillCount: number;
  messageCount: number;
  serverStartCount: number;
  serverResponseCount: number;
  serverErrorCount: number;
  feedbackCount: number;
  hasClick: boolean;
  hasPrefill: boolean;
  hasMessage: boolean;
  hasServerStart: boolean;
  hasServerResponse: boolean;
  hasFeedback: boolean;
  totalTrackedEvents: number;
}

const DEFAULT_THRESHOLDS = {
  minServerRequestsForRate: 10,
  maxServerErrorRate: 0.2,
  maxAverageLatencyMs: 12000,
  maxServerDegradedRate: 0.25,
  minServerWithSourcesRate: 0.6,
  minClientWithSourcesRate: 0.6,
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function getNumber(record: Record<string, unknown>, key: string): number {
  return toFiniteNumber(record[key]) ?? 0;
}

function getNullableNumber(record: Record<string, unknown>, key: string): number | null {
  return toFiniteNumber(record[key]);
}

function roundRate(value: number): number {
  return Number(value.toFixed(4));
}

function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }
  return roundRate(numerator / denominator);
}

function topBreakdownKey(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const first = value[0];
  if (!first || typeof first !== 'object') {
    return null;
  }
  const key = (first as Record<string, unknown>).key;
  return typeof key === 'string' && key.trim() ? key : null;
}

function getBreakdownCount(value: unknown, key: string): number {
  if (!Array.isArray(value)) {
    return 0;
  }

  const item = value.find((entry) => (
    entry
    && typeof entry === 'object'
    && (entry as Record<string, unknown>).key === key
  ));

  if (!item || typeof item !== 'object') {
    return 0;
  }

  return toFiniteNumber((item as Record<string, unknown>).count) ?? 0;
}

function getOtherBreakdownCount(value: unknown, excludedKeys: Set<string>): number {
  if (!Array.isArray(value)) {
    return 0;
  }

  return value.reduce((sum, entry) => {
    if (!entry || typeof entry !== 'object') {
      return sum;
    }

    const record = entry as Record<string, unknown>;
    const key = typeof record.key === 'string' ? record.key : '';
    if (!key || excludedKeys.has(key)) {
      return sum;
    }

    return sum + (toFiniteNumber(record.count) ?? 0);
  }, 0);
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function parseProductEntrypointCoverage(value: unknown): ProductEntrypointCoverage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const record = toRecord(entry);
      const entrySource = typeof record.entrySource === 'string' ? record.entrySource.trim() : '';
      const label = typeof record.label === 'string' && record.label.trim()
        ? record.label.trim()
        : entrySource;

      if (!entrySource || !label) {
        return null;
      }

      const clickCount = getNumber(record, 'clickCount');
      const prefillCount = getNumber(record, 'prefillCount');
      const messageCount = getNumber(record, 'messageCount');
      const serverStartCount = getNumber(record, 'serverStartCount');
      const serverResponseCount = getNumber(record, 'serverResponseCount');
      const serverErrorCount = getNumber(record, 'serverErrorCount');
      const feedbackCount = getNumber(record, 'feedbackCount');
      const calculatedTotal = clickCount
        + prefillCount
        + messageCount
        + serverStartCount
        + serverResponseCount
        + serverErrorCount
        + feedbackCount;

      return {
        entrySource,
        label,
        clickCount,
        prefillCount,
        messageCount,
        serverStartCount,
        serverResponseCount,
        serverErrorCount,
        feedbackCount,
        hasClick: toBoolean(record.hasClick) || clickCount > 0,
        hasPrefill: toBoolean(record.hasPrefill) || prefillCount > 0,
        hasMessage: toBoolean(record.hasMessage) || messageCount > 0,
        hasServerStart: toBoolean(record.hasServerStart) || serverStartCount > 0,
        hasServerResponse: toBoolean(record.hasServerResponse) || serverResponseCount > 0,
        hasFeedback: toBoolean(record.hasFeedback) || feedbackCount > 0,
        totalTrackedEvents: getNumber(record, 'totalTrackedEvents') || calculatedTotal,
      };
    })
    .filter((entry): entry is ProductEntrypointCoverage => Boolean(entry));
}

function joinLabels(items: ProductEntrypointCoverage[]) {
  return items.map((item) => item.label).join(', ');
}

function pushAction(
  actionItems: AIOpsActionItem[],
  nextActions: string[],
  action: AIOpsActionItem,
  nextAction: string,
) {
  actionItems.push(action);
  if (!nextActions.includes(nextAction)) {
    nextActions.push(nextAction);
  }
}

export function buildAIOpsReport(input: {
  overview: AIOpsOverviewInput;
  generatedAt?: string;
  thresholds?: AIOpsReportThresholds;
}): AIOpsReport {
  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...input.thresholds,
  };
  const counts = toRecord(input.overview.counts);
  const responseQuality = toRecord(input.overview.responseQuality);
  const serverAiOverview = toRecord(input.overview.serverAi);
  const rangeDays = Math.max(1, Math.floor(toFiniteNumber(input.overview.rangeDays) ?? 7));
  const productEntrypointCoverage = parseProductEntrypointCoverage(
    input.overview.productEntrypointCoverage || serverAiOverview.productEntrypointCoverage,
  );
  const opsProductEntrypointCoverage = parseProductEntrypointCoverage(
    input.overview.opsProductEntrypointCoverage || serverAiOverview.opsProductEntrypointCoverage,
  );

  const messagesSent = getNumber(counts, 'messagesSent');
  const responsesReceived = getNumber(counts, 'responsesReceived');
  const requestsStarted = getNumber(serverAiOverview, 'requestsStarted') || getNumber(counts, 'serverRequestsStarted');
  const responsesCompleted = getNumber(serverAiOverview, 'responsesCompleted') || getNumber(counts, 'serverResponsesCompleted');
  const requestErrors = getNumber(serverAiOverview, 'requestErrors') || getNumber(counts, 'serverRequestErrors');
  const recommendedQuestionsServed = getNumber(serverAiOverview, 'recommendedQuestionsServed')
    || getNumber(counts, 'serverRecommendedQuestionsServed');
  const recommendedQuestionsReturned = getNumber(serverAiOverview, 'recommendedQuestionsReturned');

  const serverErrorRate = getNullableNumber(serverAiOverview, 'errorRate') ?? safeRate(requestErrors, requestsStarted);
  const serverWithSourcesRate = getNullableNumber(serverAiOverview, 'withSourcesRate');
  const serverDegradedRate = getNullableNumber(serverAiOverview, 'degradedRate');
  const averageLatencyMs = getNullableNumber(serverAiOverview, 'averageLatencyMs');

  const clientAi = {
    messagesSent,
    responsesReceived,
    responseReceiveRate: safeRate(responsesReceived, messagesSent),
    degradedRate: getNullableNumber(responseQuality, 'degradedRate'),
    withSourcesRate: getNullableNumber(responseQuality, 'withSourcesRate'),
  };

  const serverAi = {
    requestsStarted,
    responsesCompleted,
    requestErrors,
    completionRate: safeRate(responsesCompleted, requestsStarted),
    errorRate: serverErrorRate,
    averageLatencyMs,
    degradedRate: serverDegradedRate,
    withSourcesRate: serverWithSourcesRate,
    recommendedQuestionsServed,
    recommendedQuestionsReturned,
    topEndpoint: topBreakdownKey(serverAiOverview.endpointBreakdown),
    topProvider: topBreakdownKey(serverAiOverview.providerBreakdown),
    topRoute: topBreakdownKey(serverAiOverview.routeBreakdown),
    topErrorCode: topBreakdownKey(serverAiOverview.errorCodeBreakdown),
    topEntrySource: topBreakdownKey(serverAiOverview.entrySourceBreakdown),
    opsSmokeEventCount: getBreakdownCount(serverAiOverview.entrySourceBreakdown, 'ops_ai_smoke'),
    opsEntrypointSmokeEventCount: getNumber(serverAiOverview, 'opsEntrypointSmokeEventCount'),
    nonOpsEntrySourceEventCount: getOtherBreakdownCount(
      serverAiOverview.entrySourceBreakdown,
      new Set(['ops_ai_smoke']),
    ),
  };

  const acquisition = {
    recommendedQuestionsServed,
    recommendedQuestionsReturned,
    topRecommendedStage: topBreakdownKey(serverAiOverview.recommendedStageBreakdown),
    topRecommendedSource: topBreakdownKey(serverAiOverview.recommendedSourceBreakdown),
  };

  const actionItems: AIOpsActionItem[] = [];
  const nextActions: string[] = [];
  const missingProductEntrypoints = productEntrypointCoverage.filter((entry) => (
    !entry.hasClick
    && !entry.hasPrefill
    && !entry.hasMessage
    && !entry.hasServerStart
    && !entry.hasServerResponse
  ));
  const missingServerResponseEntrypoints = productEntrypointCoverage.filter((entry) => (
    (entry.hasClick || entry.hasPrefill || entry.hasMessage || entry.hasServerStart)
    && !entry.hasServerResponse
  ));

  if (messagesSent + requestsStarted + recommendedQuestionsServed === 0) {
    pushAction(
      actionItems,
      nextActions,
      {
        area: 'ai_traffic',
        severity: 'medium',
        message: `No AI request or recommendation exposure was captured in the last ${rangeDays} day(s).`,
      },
      'Drive a small AI/chat and recommendation smoke cohort to establish baseline metrics',
    );
  }

  if (messagesSent + requestsStarted === 0 && recommendedQuestionsServed > 0) {
    pushAction(
      actionItems,
      nextActions,
      {
        area: 'ai_answer_traffic',
        severity: 'medium',
        message: `Recommendation exposure was captured, but no AI answer request was captured in the last ${rangeDays} day(s).`,
      },
      'Run a small authenticated AI/chat smoke cohort to establish answer quality and latency metrics',
    );
  }

  if (
    requestsStarted > 0
    && messagesSent === 0
    && (
      (serverAi.opsSmokeEventCount > 0 && serverAi.nonOpsEntrySourceEventCount === 0)
      || serverAi.opsEntrypointSmokeEventCount >= requestsStarted + responsesCompleted + requestErrors
    )
  ) {
    pushAction(
      actionItems,
      nextActions,
      {
        area: 'ai_real_usage_traffic',
        severity: 'medium',
        message: missingProductEntrypoints.length > 0
          ? `Only ops AI smoke answer traffic was captured in the last ${rangeDays} day(s); missing product entrypoints: ${joinLabels(missingProductEntrypoints)}.`
          : `Only ops AI smoke answer traffic was captured in the last ${rangeDays} day(s); product entrypoint usage is still missing.`,
      },
      missingProductEntrypoints.length > 0
        ? `Run an in-app AI journey cohort for missing entrypoints: ${joinLabels(missingProductEntrypoints)}`
        : 'Run a small in-app AI journey cohort from home, knowledge detail, and chat entrypoints',
    );
  }

  if (
    requestsStarted > 0
    && missingServerResponseEntrypoints.length > 0
    && serverAi.nonOpsEntrySourceEventCount > 0
  ) {
    pushAction(
      actionItems,
      nextActions,
      {
        area: 'ai_entrypoint_response_coverage',
        severity: 'medium',
        message: `Product AI entrypoints still missing server response coverage: ${joinLabels(missingServerResponseEntrypoints)}.`,
      },
      `Replay missing AI entrypoint journeys and verify server response_complete events: ${joinLabels(missingServerResponseEntrypoints)}`,
    );
  }

  if (
    requestsStarted >= thresholds.minServerRequestsForRate
    && serverAi.errorRate !== null
    && serverAi.errorRate >= thresholds.maxServerErrorRate
  ) {
    pushAction(
      actionItems,
      nextActions,
      {
        area: 'ai_error_rate',
        severity: serverAi.errorRate >= 0.5 ? 'high' : 'medium',
        message: `Server AI error rate is ${(serverAi.errorRate * 100).toFixed(1)}%.`,
        metric: serverAi.errorRate,
        threshold: thresholds.maxServerErrorRate,
      },
      serverAi.topErrorCode
        ? `Inspect top AI error code: ${serverAi.topErrorCode}`
        : 'Inspect AI request errors and provider gateway logs',
    );
  }

  if (
    responsesCompleted > 0
    && averageLatencyMs !== null
    && averageLatencyMs > thresholds.maxAverageLatencyMs
  ) {
    pushAction(
      actionItems,
      nextActions,
      {
        area: 'ai_latency',
        severity: averageLatencyMs >= thresholds.maxAverageLatencyMs * 2 ? 'high' : 'medium',
        message: `Average server AI latency is ${Math.round(averageLatencyMs)}ms.`,
        metric: averageLatencyMs,
        threshold: thresholds.maxAverageLatencyMs,
      },
      serverAi.topRoute
        ? `Review slowest/high-volume AI route: ${serverAi.topRoute}`
        : 'Review high-latency AI provider routes',
    );
  }

  if (
    responsesCompleted > 0
    && serverWithSourcesRate !== null
    && serverWithSourcesRate < thresholds.minServerWithSourcesRate
  ) {
    pushAction(
      actionItems,
      nextActions,
      {
        area: 'ai_source_coverage',
        severity: 'medium',
        message: `Only ${(serverWithSourcesRate * 100).toFixed(1)}% of server AI responses had sources.`,
        metric: serverWithSourcesRate,
        threshold: thresholds.minServerWithSourcesRate,
      },
      'Audit AI answers without sources before increasing traffic',
    );
  }

  if (
    responsesCompleted > 0
    && serverDegradedRate !== null
    && serverDegradedRate >= thresholds.maxServerDegradedRate
  ) {
    pushAction(
      actionItems,
      nextActions,
      {
        area: 'ai_degraded_rate',
        severity: serverDegradedRate >= 0.5 ? 'high' : 'medium',
        message: `Server AI degraded response rate is ${(serverDegradedRate * 100).toFixed(1)}%.`,
        metric: serverDegradedRate,
        threshold: thresholds.maxServerDegradedRate,
      },
      'Review AI provider fallback and trusted answer degradation reasons',
    );
  }

  if (
    responsesReceived > 0
    && clientAi.withSourcesRate !== null
    && clientAi.withSourcesRate < thresholds.minClientWithSourcesRate
  ) {
    pushAction(
      actionItems,
      nextActions,
      {
        area: 'client_ai_source_coverage',
        severity: 'medium',
        message: `Only ${(clientAi.withSourcesRate * 100).toFixed(1)}% of client-observed AI responses had sources.`,
        metric: clientAi.withSourcesRate,
        threshold: thresholds.minClientWithSourcesRate,
      },
      'Compare client response metadata with server AI response_complete events',
    );
  }

  return {
    generatedAt: input.generatedAt || new Date().toISOString(),
    rangeDays,
    startAt: typeof input.overview.startAt === 'string' ? input.overview.startAt : undefined,
    endAt: typeof input.overview.endAt === 'string' ? input.overview.endAt : undefined,
    status: actionItems.length > 0 ? 'attention' : 'ok',
    clientAi,
    serverAi,
    acquisition,
    productEntrypointCoverage,
    opsProductEntrypointCoverage,
    actionItems,
    nextActions,
  };
}

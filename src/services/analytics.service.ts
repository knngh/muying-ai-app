import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { ANALYTICS_FUNNEL_STEPS, type AnalyticsEventName } from '../config/analytics-events';

export type AnalyticsEventSource = 'app' | 'mini_program' | 'server';

type AnalyticsProperties = Prisma.InputJsonValue | undefined;

type AnalyticsFunnelIdentityRow = {
  eventName: string;
  userId: bigint | number | string | null;
  clientId: string | null;
  sessionId: string | null;
  createdAt: Date;
};

export async function recordAnalyticsEvent(input: {
  eventName: AnalyticsEventName;
  source: AnalyticsEventSource;
  userId?: string;
  page?: string;
  clientId?: string;
  sessionId?: string;
  properties?: AnalyticsProperties;
}) {
  await prisma.analyticsEvent.create({
    data: {
      userId: input.userId ? BigInt(input.userId) : null,
      eventName: input.eventName,
      source: input.source,
      page: input.page,
      clientId: input.clientId,
      sessionId: input.sessionId,
      properties: input.properties,
    },
  });
}

export async function recordServerAnalyticsEvent(
  eventName: AnalyticsEventName,
  input: {
    userId?: string;
    page?: string;
    properties?: AnalyticsProperties;
  } = {},
) {
  await recordAnalyticsEvent({
    eventName,
    source: 'server',
    userId: input.userId,
    page: input.page,
    properties: input.properties,
  });
}

export async function getAnalyticsFunnel(rangeDays: number) {
  const startAt = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
  const funnelEventNames = ANALYTICS_FUNNEL_STEPS.map((step) => step.eventName);

  const [grouped, identityRows] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ['eventName'],
      where: {
        createdAt: {
          gte: startAt,
        },
        eventName: {
          in: funnelEventNames,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.analyticsEvent.findMany({
      where: {
        createdAt: {
          gte: startAt,
        },
        eventName: {
          in: funnelEventNames,
        },
      },
      select: {
        eventName: true,
        userId: true,
        clientId: true,
        sessionId: true,
        createdAt: true,
      },
    }) as Promise<AnalyticsFunnelIdentityRow[]>,
  ]);

  const counts = new Map<string, number>(
    grouped.map((item: { eventName: string; _count: { _all: number } }) => [item.eventName, item._count._all]),
  );
  const firstStepCount = Number(counts.get(ANALYTICS_FUNNEL_STEPS[0].eventName) ?? 0);
  const identitySetsByEvent = new Map<string, Set<string>>();
  const unidentifiedCountsByEvent = new Map<string, number>();

  for (const row of identityRows) {
    const identity = getAnalyticsFunnelIdentity(row);
    if (!identity) {
      unidentifiedCountsByEvent.set(row.eventName, (unidentifiedCountsByEvent.get(row.eventName) || 0) + 1);
      continue;
    }

    const identities = identitySetsByEvent.get(row.eventName) || new Set<string>();
    identities.add(identity);
    identitySetsByEvent.set(row.eventName, identities);
  }

  const firstStepUniqueCount = identitySetsByEvent.get(ANALYTICS_FUNNEL_STEPS[0].eventName)?.size || 0;
  const totalUnidentifiedEvents = Array.from(unidentifiedCountsByEvent.values()).reduce((sum, count) => sum + count, 0);
  const totalIdentifiedEvents = identityRows.length - totalUnidentifiedEvents;

  return {
    rangeDays,
    startAt: startAt.toISOString(),
    endAt: new Date().toISOString(),
    steps: ANALYTICS_FUNNEL_STEPS.map((step) => {
      const count = Number(counts.get(step.eventName) ?? 0);

      return {
        eventName: step.eventName,
        label: step.label,
        count,
        conversionRate: firstStepCount > 0 ? Number(((count / firstStepCount) * 100).toFixed(1)) : null,
      };
    }),
    uniqueIdentityPriority: ['userId', 'clientId', 'sessionId'],
    uniqueSummary: {
      firstStepUniqueCount,
      totalIdentifiedEvents,
      totalUnidentifiedEvents,
      identityCoverageRate: identityRows.length > 0
        ? Number((totalIdentifiedEvents / identityRows.length).toFixed(4))
        : null,
    },
    uniqueSteps: ANALYTICS_FUNNEL_STEPS.map((step) => {
      const uniqueCount = identitySetsByEvent.get(step.eventName)?.size || 0;
      const unidentifiedCount = unidentifiedCountsByEvent.get(step.eventName) || 0;

      return {
        eventName: step.eventName,
        label: step.label,
        uniqueCount,
        unidentifiedCount,
        conversionRate: firstStepUniqueCount > 0
          ? Number(((uniqueCount / firstStepUniqueCount) * 100).toFixed(1))
          : null,
      };
    }),
  };
}

function getAnalyticsFunnelIdentity(row: AnalyticsFunnelIdentityRow): string | null {
  if (row.userId !== null && row.userId !== undefined) {
    return `user:${row.userId.toString()}`;
  }
  if (row.clientId) {
    return `client:${row.clientId}`;
  }
  if (row.sessionId) {
    return `session:${row.sessionId}`;
  }
  return null;
}

type AIOverviewRow = {
  eventName: string;
  page: string | null;
  properties: Prisma.JsonValue | null;
};

const PRODUCT_AI_ENTRYPOINTS = [
  { entrySource: 'home_suggested_question', label: 'Home suggested question' },
  { entrySource: 'weekly_report', label: 'Weekly report AI' },
  { entrySource: 'knowledge_detail', label: 'Knowledge detail AI' },
  { entrySource: 'knowledge_recent_ai', label: 'Knowledge recent AI' },
  { entrySource: 'native', label: 'Native chat' },
] as const;

const AI_OVERVIEW_EVENT_NAMES = [
  'app_home_suggested_question_click',
  'app_chat_prefill_entry',
  'app_chat_message_send',
  'app_chat_response_receive',
  'app_chat_add_calendar_click',
  'app_chat_open_knowledge_click',
  'app_chat_open_hit_article_click',
  'app_chat_open_archive_click',
  'app_knowledge_recent_ai_hit_click',
  'app_knowledge_recent_ai_topic_click',
  'app_knowledge_recent_ai_source_click',
  'app_knowledge_recent_ai_ask_click',
  'app_knowledge_detail_ai_hit_open',
  'app_weekly_report_ask_ai_click',
  'app_knowledge_detail_ask_ai_click',
  'ai_qa_feedback',
  'server_ai_request_start',
  'server_ai_response_complete',
  'server_ai_request_error',
  'server_ai_knowledge_recommendations_served',
];

function toRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function incrementCounter(counter: Map<string, number>, key: string | undefined) {
  if (!key) {
    return;
  }
  counter.set(key, (counter.get(key) || 0) + 1);
}

function createEntrypointCounter() {
  return new Map<string, number>();
}

function getEntrypointFromProperties(properties: Record<string, unknown>): string | undefined {
  if (typeof properties.entrySource === 'string' && properties.entrySource.trim()) {
    return properties.entrySource;
  }
  if (typeof properties.source === 'string' && properties.source.trim()) {
    return properties.source;
  }
  return undefined;
}

function isOpsProductEntrypointSmoke(properties: Record<string, unknown>): boolean {
  const trafficKind = typeof properties.trafficKind === 'string' ? properties.trafficKind : '';
  const reportId = typeof properties.reportId === 'string' ? properties.reportId : '';
  const clientRequestId = typeof properties.clientRequestId === 'string' ? properties.clientRequestId : '';

  return trafficKind === 'ops_product_entrypoint_smoke'
    || reportId.startsWith('ops-ai-entrypoint-smoke')
    || clientRequestId.startsWith('ops-ai-entrypoint-smoke');
}

function incrementLineageCounters(
  properties: Record<string, unknown>,
  entrySourceCounter: Map<string, number>,
  articleSlugCounter: Map<string, number>,
  reportIdCounter: Map<string, number>,
) {
  incrementCounter(entrySourceCounter, typeof properties.entrySource === 'string' ? properties.entrySource : undefined);
  incrementCounter(articleSlugCounter, typeof properties.articleSlug === 'string' ? properties.articleSlug : undefined);
  incrementCounter(reportIdCounter, typeof properties.reportId === 'string' ? properties.reportId : undefined);
}

function toBreakdown(counter: Map<string, number>) {
  return Array.from(counter.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'zh-CN'));
}

export async function getAIOverview(rangeDays: number) {
  const startAt = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.analyticsEvent.findMany({
    where: {
      createdAt: {
        gte: startAt,
      },
      eventName: {
        in: AI_OVERVIEW_EVENT_NAMES,
      },
    },
    select: {
      eventName: true,
      page: true,
      properties: true,
    },
  }) as AIOverviewRow[];

  const sourceReliabilityCounter = new Map<string, number>();
  const routeCounter = new Map<string, number>();
  const riskLevelCounter = new Map<string, number>();
  const feedbackCounter = new Map<string, number>();
  const feedbackReasonCounter = new Map<string, number>();
  const entrySourceCounter = new Map<string, number>();
  const articleSlugCounter = new Map<string, number>();
  const reportIdCounter = new Map<string, number>();
  const recentAiAskTargetCounter = new Map<string, number>();
  const recentAiHitMatchReasonCounter = new Map<string, number>();
  const recentAiDetailOpenMatchReasonCounter = new Map<string, number>();
  const recentAiTopicCounter = new Map<string, number>();
  const recentAiSourceCounter = new Map<string, number>();
  const recentAiPageCounter = new Map<string, number>();
  const recentAiEntrySourceCounter = new Map<string, number>();
  const recentAiArticleSlugCounter = new Map<string, number>();
  const recentAiReportIdCounter = new Map<string, number>();
  const serverEndpointCounter = new Map<string, number>();
  const serverProviderCounter = new Map<string, number>();
  const serverModelCounter = new Map<string, number>();
  const serverRouteCounter = new Map<string, number>();
  const serverRiskLevelCounter = new Map<string, number>();
  const serverSourceReliabilityCounter = new Map<string, number>();
  const serverErrorCodeCounter = new Map<string, number>();
  const serverRecommendedStageCounter = new Map<string, number>();
  const serverRecommendedSourceCounter = new Map<string, number>();
  const serverEntrySourceCounter = new Map<string, number>();
  const serverArticleSlugCounter = new Map<string, number>();
  const serverReportIdCounter = new Map<string, number>();
  const entrypointClickCounter = createEntrypointCounter();
  const entrypointPrefillCounter = createEntrypointCounter();
  const entrypointMessageCounter = createEntrypointCounter();
  const entrypointServerStartCounter = createEntrypointCounter();
  const entrypointServerResponseCounter = createEntrypointCounter();
  const entrypointServerErrorCounter = createEntrypointCounter();
  const entrypointFeedbackCounter = createEntrypointCounter();
  const opsEntrypointClickCounter = createEntrypointCounter();
  const opsEntrypointPrefillCounter = createEntrypointCounter();
  const opsEntrypointMessageCounter = createEntrypointCounter();
  const opsEntrypointServerStartCounter = createEntrypointCounter();
  const opsEntrypointServerResponseCounter = createEntrypointCounter();
  const opsEntrypointServerErrorCounter = createEntrypointCounter();
  const opsEntrypointFeedbackCounter = createEntrypointCounter();

  let messagesSent = 0;
  let responsesReceived = 0;
  let degradedCount = 0;
  let withSourcesCount = 0;
  let totalSourcesCount = 0;
  let addCalendarClicks = 0;
  let openKnowledgeClicks = 0;
  let openHitArticleClicks = 0;
  let openArchiveClicks = 0;
  let knowledgeRecentAiHitClicks = 0;
  let knowledgeRecentAiTopicClicks = 0;
  let knowledgeRecentAiSourceClicks = 0;
  let knowledgeRecentAiAskClicks = 0;
  let knowledgeDetailAiHitOpens = 0;
  let weeklyReportAskAiClicks = 0;
  let knowledgeDetailAskAiClicks = 0;
  let serverRequestsStarted = 0;
  let serverResponsesCompleted = 0;
  let serverRequestErrors = 0;
  let serverRecommendedQuestionsServed = 0;
  let serverRecommendedQuestionsReturned = 0;
  let serverTotalLatencyMs = 0;
  let serverDegradedCount = 0;
  let serverEmergencyCount = 0;
  let serverWithSourcesCount = 0;
  let serverTotalSourcesCount = 0;

  for (const row of rows) {
    const properties = toRecord(row.properties);
    const entrypoint = getEntrypointFromProperties(properties);
    const isOpsEntrypointSmoke = isOpsProductEntrypointSmoke(properties);

    switch (row.eventName) {
      case 'app_chat_message_send':
        incrementCounter(
          isOpsEntrypointSmoke ? opsEntrypointMessageCounter : entrypointMessageCounter,
          entrypoint || 'native',
        );
        if (!isOpsEntrypointSmoke) {
          messagesSent += 1;
          incrementLineageCounters(properties, entrySourceCounter, articleSlugCounter, reportIdCounter);
        }
        break;
      case 'app_chat_prefill_entry':
        incrementCounter(
          isOpsEntrypointSmoke ? opsEntrypointPrefillCounter : entrypointPrefillCounter,
          entrypoint,
        );
        break;
      case 'app_chat_response_receive':
        if (isOpsEntrypointSmoke) {
          break;
        }
        responsesReceived += 1;
        incrementLineageCounters(properties, entrySourceCounter, articleSlugCounter, reportIdCounter);
        if (toBoolean(properties.degraded)) {
          degradedCount += 1;
        }
        totalSourcesCount += toNumber(properties.sourcesCount);
        if (toNumber(properties.sourcesCount) > 0) {
          withSourcesCount += 1;
        }
        incrementCounter(sourceReliabilityCounter, typeof properties.sourceReliability === 'string' ? properties.sourceReliability : undefined);
        incrementCounter(routeCounter, typeof properties.route === 'string' ? properties.route : undefined);
        incrementCounter(riskLevelCounter, typeof properties.riskLevel === 'string' ? properties.riskLevel : undefined);
        break;
      case 'app_chat_add_calendar_click':
        addCalendarClicks += 1;
        incrementLineageCounters(properties, entrySourceCounter, articleSlugCounter, reportIdCounter);
        break;
      case 'app_chat_open_knowledge_click':
        openKnowledgeClicks += 1;
        incrementLineageCounters(properties, entrySourceCounter, articleSlugCounter, reportIdCounter);
        break;
      case 'app_chat_open_hit_article_click':
        openHitArticleClicks += 1;
        incrementLineageCounters(properties, entrySourceCounter, articleSlugCounter, reportIdCounter);
        break;
      case 'app_chat_open_archive_click':
        openArchiveClicks += 1;
        incrementLineageCounters(properties, entrySourceCounter, articleSlugCounter, reportIdCounter);
        break;
      case 'app_weekly_report_ask_ai_click':
        if (!isOpsEntrypointSmoke) {
          weeklyReportAskAiClicks += 1;
        }
        incrementCounter(
          isOpsEntrypointSmoke ? opsEntrypointClickCounter : entrypointClickCounter,
          entrypoint || 'weekly_report',
        );
        break;
      case 'app_knowledge_detail_ask_ai_click':
        if (!isOpsEntrypointSmoke) {
          knowledgeDetailAskAiClicks += 1;
        }
        incrementCounter(
          isOpsEntrypointSmoke ? opsEntrypointClickCounter : entrypointClickCounter,
          entrypoint || 'knowledge_detail',
        );
        break;
      case 'app_home_suggested_question_click':
        incrementCounter(
          isOpsEntrypointSmoke ? opsEntrypointClickCounter : entrypointClickCounter,
          entrypoint || 'home_suggested_question',
        );
        break;
      case 'app_knowledge_recent_ai_hit_click':
        knowledgeRecentAiHitClicks += 1;
        incrementCounter(recentAiPageCounter, row.page || undefined);
        incrementLineageCounters(properties, recentAiEntrySourceCounter, recentAiArticleSlugCounter, recentAiReportIdCounter);
        incrementCounter(recentAiHitMatchReasonCounter, typeof properties.matchReason === 'string' ? properties.matchReason : undefined);
        break;
      case 'app_knowledge_recent_ai_topic_click':
        knowledgeRecentAiTopicClicks += 1;
        incrementCounter(recentAiPageCounter, row.page || undefined);
        incrementLineageCounters(properties, recentAiEntrySourceCounter, recentAiArticleSlugCounter, recentAiReportIdCounter);
        incrementCounter(recentAiTopicCounter, typeof properties.displayName === 'string'
          ? properties.displayName
          : (typeof properties.topic === 'string' ? properties.topic : undefined));
        break;
      case 'app_knowledge_recent_ai_source_click':
        knowledgeRecentAiSourceClicks += 1;
        incrementCounter(recentAiPageCounter, row.page || undefined);
        incrementLineageCounters(properties, recentAiEntrySourceCounter, recentAiArticleSlugCounter, recentAiReportIdCounter);
        incrementCounter(recentAiSourceCounter, typeof properties.displayName === 'string'
          ? properties.displayName
          : (typeof properties.sourceOrg === 'string' ? properties.sourceOrg : undefined));
        break;
      case 'app_knowledge_recent_ai_ask_click':
        incrementCounter(isOpsEntrypointSmoke ? opsEntrypointClickCounter : entrypointClickCounter, 'knowledge_recent_ai');
        if (!isOpsEntrypointSmoke) {
          knowledgeRecentAiAskClicks += 1;
          incrementCounter(recentAiPageCounter, row.page || undefined);
          incrementLineageCounters(properties, recentAiEntrySourceCounter, recentAiArticleSlugCounter, recentAiReportIdCounter);
          incrementCounter(recentAiAskTargetCounter, typeof properties.targetType === 'string' ? properties.targetType : undefined);
        }
        break;
      case 'app_knowledge_detail_ai_hit_open':
        knowledgeDetailAiHitOpens += 1;
        incrementCounter(recentAiPageCounter, row.page || undefined);
        incrementLineageCounters(properties, recentAiEntrySourceCounter, recentAiArticleSlugCounter, recentAiReportIdCounter);
        incrementCounter(recentAiDetailOpenMatchReasonCounter, typeof properties.matchReason === 'string' ? properties.matchReason : undefined);
        break;
      case 'ai_qa_feedback':
        incrementCounter(
          isOpsEntrypointSmoke ? opsEntrypointFeedbackCounter : entrypointFeedbackCounter,
          entrypoint,
        );
        if (!isOpsEntrypointSmoke) {
          incrementLineageCounters(properties, entrySourceCounter, articleSlugCounter, reportIdCounter);
          incrementCounter(feedbackCounter, typeof properties.feedback === 'string' ? properties.feedback : undefined);
          incrementCounter(feedbackReasonCounter, typeof properties.reason === 'string' ? properties.reason : undefined);
        }
        break;
      case 'server_ai_request_start':
        serverRequestsStarted += 1;
        incrementLineageCounters(properties, serverEntrySourceCounter, serverArticleSlugCounter, serverReportIdCounter);
        incrementCounter(
          isOpsEntrypointSmoke ? opsEntrypointServerStartCounter : entrypointServerStartCounter,
          entrypoint || 'native',
        );
        incrementCounter(serverEndpointCounter, typeof properties.endpoint === 'string' ? properties.endpoint : undefined);
        break;
      case 'server_ai_response_complete':
        serverResponsesCompleted += 1;
        incrementLineageCounters(properties, serverEntrySourceCounter, serverArticleSlugCounter, serverReportIdCounter);
        incrementCounter(
          isOpsEntrypointSmoke ? opsEntrypointServerResponseCounter : entrypointServerResponseCounter,
          entrypoint || 'native',
        );
        incrementCounter(serverEndpointCounter, typeof properties.endpoint === 'string' ? properties.endpoint : undefined);
        incrementCounter(serverProviderCounter, typeof properties.provider === 'string' ? properties.provider : undefined);
        incrementCounter(serverModelCounter, typeof properties.model === 'string' ? properties.model : undefined);
        incrementCounter(serverRouteCounter, typeof properties.route === 'string' ? properties.route : undefined);
        incrementCounter(serverRiskLevelCounter, typeof properties.riskLevel === 'string' ? properties.riskLevel : undefined);
        incrementCounter(serverSourceReliabilityCounter, typeof properties.sourceReliability === 'string' ? properties.sourceReliability : undefined);
        if (toBoolean(properties.degraded)) {
          serverDegradedCount += 1;
        }
        if (toBoolean(properties.isEmergency)) {
          serverEmergencyCount += 1;
        }
        serverTotalLatencyMs += toNumber(properties.durationMs);
        serverTotalSourcesCount += toNumber(properties.sourcesCount);
        if (toNumber(properties.sourcesCount) > 0) {
          serverWithSourcesCount += 1;
        }
        break;
      case 'server_ai_request_error':
        serverRequestErrors += 1;
        incrementLineageCounters(properties, serverEntrySourceCounter, serverArticleSlugCounter, serverReportIdCounter);
        incrementCounter(
          isOpsEntrypointSmoke ? opsEntrypointServerErrorCounter : entrypointServerErrorCounter,
          entrypoint || 'native',
        );
        incrementCounter(serverEndpointCounter, typeof properties.endpoint === 'string' ? properties.endpoint : undefined);
        incrementCounter(serverErrorCodeCounter, typeof properties.errorCode === 'string' ? properties.errorCode : undefined);
        break;
      case 'server_ai_knowledge_recommendations_served':
        serverRecommendedQuestionsServed += 1;
        serverRecommendedQuestionsReturned += toNumber(properties.returnedCount);
        incrementCounter(serverRecommendedStageCounter, typeof properties.stage === 'string' ? properties.stage : undefined);
        incrementCounter(serverRecommendedSourceCounter, typeof properties.source === 'string' ? properties.source : undefined);
        break;
      default:
        break;
    }
  }

  const productEntrypointCoverage = PRODUCT_AI_ENTRYPOINTS
    .map(({ entrySource, label }) => {
      const clickCount = entrypointClickCounter.get(entrySource) || 0;
      const prefillCount = entrypointPrefillCounter.get(entrySource) || 0;
      const messageCount = entrypointMessageCounter.get(entrySource) || 0;
      const serverStartCount = entrypointServerStartCounter.get(entrySource) || 0;
      const serverResponseCount = entrypointServerResponseCounter.get(entrySource) || 0;
      const serverErrorCount = entrypointServerErrorCounter.get(entrySource) || 0;
      const feedbackCount = entrypointFeedbackCounter.get(entrySource) || 0;

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
        hasClick: clickCount > 0,
        hasPrefill: prefillCount > 0,
        hasMessage: messageCount > 0,
        hasServerStart: serverStartCount > 0,
        hasServerResponse: serverResponseCount > 0,
        hasFeedback: feedbackCount > 0,
        totalTrackedEvents: clickCount
          + prefillCount
          + messageCount
          + serverStartCount
          + serverResponseCount
          + serverErrorCount
          + feedbackCount,
      };
    })
    .sort((a, b) => b.totalTrackedEvents - a.totalTrackedEvents || a.label.localeCompare(b.label, 'zh-CN'));
  const opsProductEntrypointCoverage = PRODUCT_AI_ENTRYPOINTS
    .map(({ entrySource, label }) => {
      const clickCount = opsEntrypointClickCounter.get(entrySource) || 0;
      const prefillCount = opsEntrypointPrefillCounter.get(entrySource) || 0;
      const messageCount = opsEntrypointMessageCounter.get(entrySource) || 0;
      const serverStartCount = opsEntrypointServerStartCounter.get(entrySource) || 0;
      const serverResponseCount = opsEntrypointServerResponseCounter.get(entrySource) || 0;
      const serverErrorCount = opsEntrypointServerErrorCounter.get(entrySource) || 0;
      const feedbackCount = opsEntrypointFeedbackCounter.get(entrySource) || 0;

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
        hasClick: clickCount > 0,
        hasPrefill: prefillCount > 0,
        hasMessage: messageCount > 0,
        hasServerStart: serverStartCount > 0,
        hasServerResponse: serverResponseCount > 0,
        hasFeedback: feedbackCount > 0,
        totalTrackedEvents: clickCount
          + prefillCount
          + messageCount
          + serverStartCount
          + serverResponseCount
          + serverErrorCount
          + feedbackCount,
      };
    })
    .sort((a, b) => b.totalTrackedEvents - a.totalTrackedEvents || a.label.localeCompare(b.label, 'zh-CN'));

  return {
    rangeDays,
    startAt: startAt.toISOString(),
    endAt: new Date().toISOString(),
    counts: {
      messagesSent,
      responsesReceived,
      addCalendarClicks,
      openKnowledgeClicks,
      openHitArticleClicks,
      openArchiveClicks,
      knowledgeRecentAiHitClicks,
      knowledgeRecentAiTopicClicks,
      knowledgeRecentAiSourceClicks,
      knowledgeRecentAiAskClicks,
      knowledgeDetailAiHitOpens,
      weeklyReportAskAiClicks,
      knowledgeDetailAskAiClicks,
      feedbackTotal: Array.from(feedbackCounter.values()).reduce((sum, count) => sum + count, 0),
      serverRequestsStarted,
      serverResponsesCompleted,
      serverRequestErrors,
      serverRecommendedQuestionsServed,
    },
    responseQuality: {
      degradedCount,
      degradedRate: responsesReceived > 0 ? Number((degradedCount / responsesReceived).toFixed(4)) : null,
      withSourcesCount,
      withSourcesRate: responsesReceived > 0 ? Number((withSourcesCount / responsesReceived).toFixed(4)) : null,
      averageSourcesCount: responsesReceived > 0 ? Number((totalSourcesCount / responsesReceived).toFixed(2)) : null,
    },
    sourceReliability: toBreakdown(sourceReliabilityCounter),
    routeBreakdown: toBreakdown(routeCounter),
    riskLevelBreakdown: toBreakdown(riskLevelCounter),
    entrySourceBreakdown: toBreakdown(entrySourceCounter),
    articleSlugBreakdown: toBreakdown(articleSlugCounter).slice(0, 20),
    reportIdBreakdown: toBreakdown(reportIdCounter).slice(0, 20),
    feedbackBreakdown: toBreakdown(feedbackCounter),
    feedbackReasonBreakdown: toBreakdown(feedbackReasonCounter),
    productEntrypointCoverage,
    opsProductEntrypointCoverage,
    recentAiJourney: {
      askTargetBreakdown: toBreakdown(recentAiAskTargetCounter),
      hitMatchReasonBreakdown: toBreakdown(recentAiHitMatchReasonCounter),
      detailOpenMatchReasonBreakdown: toBreakdown(recentAiDetailOpenMatchReasonCounter),
      topicBreakdown: toBreakdown(recentAiTopicCounter).slice(0, 10),
      sourceBreakdown: toBreakdown(recentAiSourceCounter).slice(0, 10),
      pageBreakdown: toBreakdown(recentAiPageCounter),
      entrySourceBreakdown: toBreakdown(recentAiEntrySourceCounter),
      articleSlugBreakdown: toBreakdown(recentAiArticleSlugCounter).slice(0, 20),
      reportIdBreakdown: toBreakdown(recentAiReportIdCounter).slice(0, 20),
    },
    serverAi: {
      requestsStarted: serverRequestsStarted,
      responsesCompleted: serverResponsesCompleted,
      requestErrors: serverRequestErrors,
      errorRate: serverRequestsStarted > 0
        ? Number((serverRequestErrors / serverRequestsStarted).toFixed(4))
        : null,
      averageLatencyMs: serverResponsesCompleted > 0
        ? Number((serverTotalLatencyMs / serverResponsesCompleted).toFixed(0))
        : null,
      degradedCount: serverDegradedCount,
      degradedRate: serverResponsesCompleted > 0 ? Number((serverDegradedCount / serverResponsesCompleted).toFixed(4)) : null,
      emergencyCount: serverEmergencyCount,
      emergencyRate: serverResponsesCompleted > 0 ? Number((serverEmergencyCount / serverResponsesCompleted).toFixed(4)) : null,
      withSourcesCount: serverWithSourcesCount,
      withSourcesRate: serverResponsesCompleted > 0 ? Number((serverWithSourcesCount / serverResponsesCompleted).toFixed(4)) : null,
      averageSourcesCount: serverResponsesCompleted > 0 ? Number((serverTotalSourcesCount / serverResponsesCompleted).toFixed(2)) : null,
      recommendedQuestionsServed: serverRecommendedQuestionsServed,
      recommendedQuestionsReturned: serverRecommendedQuestionsReturned,
      endpointBreakdown: toBreakdown(serverEndpointCounter),
      providerBreakdown: toBreakdown(serverProviderCounter),
      modelBreakdown: toBreakdown(serverModelCounter).slice(0, 10),
      routeBreakdown: toBreakdown(serverRouteCounter).slice(0, 20),
      riskLevelBreakdown: toBreakdown(serverRiskLevelCounter),
      sourceReliabilityBreakdown: toBreakdown(serverSourceReliabilityCounter),
      errorCodeBreakdown: toBreakdown(serverErrorCodeCounter),
      recommendedStageBreakdown: toBreakdown(serverRecommendedStageCounter),
      recommendedSourceBreakdown: toBreakdown(serverRecommendedSourceCounter),
      opsEntrypointSmokeEventCount: Array.from(opsEntrypointServerStartCounter.values()).reduce((sum, count) => sum + count, 0)
        + Array.from(opsEntrypointServerResponseCounter.values()).reduce((sum, count) => sum + count, 0)
        + Array.from(opsEntrypointServerErrorCounter.values()).reduce((sum, count) => sum + count, 0),
      entrySourceBreakdown: toBreakdown(serverEntrySourceCounter),
      articleSlugBreakdown: toBreakdown(serverArticleSlugCounter).slice(0, 20),
      reportIdBreakdown: toBreakdown(serverReportIdCounter).slice(0, 20),
    },
  };
}

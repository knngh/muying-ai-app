import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { ANALYTICS_FUNNEL_STEPS, type AnalyticsEventName } from '../config/analytics-events';

export type AnalyticsEventSource = 'app' | 'mini_program' | 'server';

type AnalyticsProperties = Prisma.InputJsonValue | undefined;

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

  const grouped = await prisma.analyticsEvent.groupBy({
    by: ['eventName'],
    where: {
      createdAt: {
        gte: startAt,
      },
      eventName: {
        in: ANALYTICS_FUNNEL_STEPS.map((step) => step.eventName),
      },
    },
    _count: {
      _all: true,
    },
  });

  const counts = new Map<string, number>(
    grouped.map((item: { eventName: string; _count: { _all: number } }) => [item.eventName, item._count._all]),
  );
  const firstStepCount = Number(counts.get(ANALYTICS_FUNNEL_STEPS[0].eventName) ?? 0);

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
  };
}

type AIOverviewRow = {
  eventName: string;
  page: string | null;
  properties: Prisma.JsonValue | null;
};

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
        in: [
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
        ],
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

  for (const row of rows) {
    const properties = toRecord(row.properties);

    switch (row.eventName) {
      case 'app_chat_message_send':
        messagesSent += 1;
        incrementLineageCounters(properties, entrySourceCounter, articleSlugCounter, reportIdCounter);
        break;
      case 'app_chat_response_receive':
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
        weeklyReportAskAiClicks += 1;
        break;
      case 'app_knowledge_detail_ask_ai_click':
        knowledgeDetailAskAiClicks += 1;
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
        knowledgeRecentAiAskClicks += 1;
        incrementCounter(recentAiPageCounter, row.page || undefined);
        incrementLineageCounters(properties, recentAiEntrySourceCounter, recentAiArticleSlugCounter, recentAiReportIdCounter);
        incrementCounter(recentAiAskTargetCounter, typeof properties.targetType === 'string' ? properties.targetType : undefined);
        break;
      case 'app_knowledge_detail_ai_hit_open':
        knowledgeDetailAiHitOpens += 1;
        incrementCounter(recentAiPageCounter, row.page || undefined);
        incrementLineageCounters(properties, recentAiEntrySourceCounter, recentAiArticleSlugCounter, recentAiReportIdCounter);
        incrementCounter(recentAiDetailOpenMatchReasonCounter, typeof properties.matchReason === 'string' ? properties.matchReason : undefined);
        break;
      case 'ai_qa_feedback':
        incrementLineageCounters(properties, entrySourceCounter, articleSlugCounter, reportIdCounter);
        incrementCounter(feedbackCounter, typeof properties.feedback === 'string' ? properties.feedback : undefined);
        incrementCounter(feedbackReasonCounter, typeof properties.reason === 'string' ? properties.reason : undefined);
        break;
      default:
        break;
    }
  }

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
  };
}

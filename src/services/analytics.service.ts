import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_FUNNEL_STEPS,
  ANALYTICS_RETENTION_BEHAVIOR_EVENT_NAMES,
  type AnalyticsEventName,
} from '../config/analytics-events';

export type AnalyticsEventSource = 'app' | 'mini_program' | 'server';

type AnalyticsProperties = Prisma.InputJsonValue | undefined;

type AnalyticsFunnelIdentityRow = {
  eventName: string;
  userId: bigint | number | string | null;
  clientId: string | null;
  sessionId: string | null;
  createdAt: Date;
};

type AnalyticsActivationRow = {
  eventName: string;
  userId: bigint | number | string | null;
  clientId: string | null;
  sessionId: string | null;
  source: string;
  page: string | null;
  properties: Prisma.JsonValue | null;
  createdAt: Date;
};

type AnalyticsRetentionRow = AnalyticsActivationRow;
type AnalyticsAcquisitionRow = AnalyticsActivationRow;

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

export function recordServerRetentionBehaviorEvent(
  eventName: typeof ANALYTICS_RETENTION_BEHAVIOR_EVENT_NAMES[number],
  input: {
    userId: string;
    page: string;
    properties?: AnalyticsProperties;
  },
) {
  return recordServerAnalyticsEvent(eventName, input);
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

const ACTIVATION_EVENT_NAMES = [
  'server_lifecycle_profile_ready',
  'app_chat_message_send',
  'app_knowledge_detail_open',
] as const;

const RETENTION_EVENT_NAMES = ANALYTICS_EVENT_NAMES;
const RETENTION_BEHAVIOR_EVENT_NAMES = new Set<string>(ANALYTICS_RETENTION_BEHAVIOR_EVENT_NAMES);
const ACQUISITION_EVENT_NAME = 'mini_program_app_download_click';
const ACQUISITION_ACTIVATION_EVENT_NAMES = [
  'server_lifecycle_profile_ready',
  'app_chat_message_send',
  'app_knowledge_detail_open',
] as const;
const ACQUISITION_PAYMENT_EVENT_NAMES = [
  'app_order_created',
  'app_payment_success',
] as const;
const ACQUISITION_ACTIVATION_EVENT_SET = new Set<string>(ACQUISITION_ACTIVATION_EVENT_NAMES);
const ACQUISITION_ORDER_CREATED_EVENT_NAME = 'app_order_created';
const ACQUISITION_PAYMENT_SUCCESS_EVENT_NAME = 'app_payment_success';

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

function getStringProperty(properties: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function getAcquisitionChannel(properties: Record<string, unknown>): string | undefined {
  return getStringProperty(properties, [
    'acquisitionChannel',
    'trafficChannel',
    'utmChannel',
    'utmSource',
    'utm_source',
    'sourceChannel',
    'channel',
  ]);
}

function getAcquisitionCampaign(properties: Record<string, unknown>): string | undefined {
  return getStringProperty(properties, [
    'acquisitionCampaign',
    'campaign',
    'campaignId',
    'utmCampaign',
    'utm_campaign',
    'activity',
    'promotion',
  ]);
}

function getAcquisitionScene(properties: Record<string, unknown>): string | undefined {
  return getStringProperty(properties, [
    'acquisitionScene',
    'scene',
    'entryScene',
    'fromScene',
    'triggerScene',
    'downloadScene',
  ]);
}

function getAcquisitionEntrySource(properties: Record<string, unknown>): string | undefined {
  return getStringProperty(properties, [
    'acquisitionEntrySource',
    'entrySource',
    'source',
  ]);
}

type AcquisitionSegmentStats = {
  eventCount: number;
  acquisitionEventCount: number;
  identities: Set<string>;
  acquisitionIdentities: Set<string>;
  activatedIdentities: Set<string>;
  orderCreatedIdentities: Set<string>;
  paymentSuccessIdentities: Set<string>;
};

function createAcquisitionSegmentStats(): AcquisitionSegmentStats {
  return {
    eventCount: 0,
    acquisitionEventCount: 0,
    identities: new Set<string>(),
    acquisitionIdentities: new Set<string>(),
    activatedIdentities: new Set<string>(),
    orderCreatedIdentities: new Set<string>(),
    paymentSuccessIdentities: new Set<string>(),
  };
}

function updateAcquisitionSegmentStats(
  stats: AcquisitionSegmentStats,
  eventName: string,
  identity: string | null,
) {
  stats.eventCount += 1;
  if (eventName === ACQUISITION_EVENT_NAME) {
    stats.acquisitionEventCount += 1;
  }

  if (!identity) {
    return;
  }

  stats.identities.add(identity);
  if (eventName === ACQUISITION_EVENT_NAME) {
    stats.acquisitionIdentities.add(identity);
  }
  if (ACQUISITION_ACTIVATION_EVENT_SET.has(eventName)) {
    stats.activatedIdentities.add(identity);
  }
  if (eventName === ACQUISITION_ORDER_CREATED_EVENT_NAME) {
    stats.orderCreatedIdentities.add(identity);
  }
  if (eventName === ACQUISITION_PAYMENT_SUCCESS_EVENT_NAME) {
    stats.paymentSuccessIdentities.add(identity);
  }
}

function toAcquisitionRate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

function toAcquisitionBreakdown(statsByKey: Map<string, AcquisitionSegmentStats>) {
  return Array.from(statsByKey.entries())
    .map(([key, stats]) => {
      const acquisitionUniqueCount = stats.acquisitionIdentities.size;

      return {
        key,
        eventCount: stats.eventCount,
        acquisitionEventCount: stats.acquisitionEventCount,
        acquisitionUniqueCount,
        activatedUniqueCount: stats.activatedIdentities.size,
        orderCreatedUniqueCount: stats.orderCreatedIdentities.size,
        paymentSuccessUniqueCount: stats.paymentSuccessIdentities.size,
        acquisitionToActivationRate: toAcquisitionRate(stats.activatedIdentities.size, acquisitionUniqueCount),
        acquisitionToPaymentRate: toAcquisitionRate(stats.paymentSuccessIdentities.size, acquisitionUniqueCount),
      };
    })
    .sort((a, b) => (
      b.paymentSuccessUniqueCount - a.paymentSuccessUniqueCount
      || b.activatedUniqueCount - a.activatedUniqueCount
      || b.acquisitionUniqueCount - a.acquisitionUniqueCount
      || b.acquisitionEventCount - a.acquisitionEventCount
      || a.key.localeCompare(b.key, 'zh-CN')
    ));
}

type AcquisitionSegmentDimension = {
  channel: string | null;
  campaign: string | null;
  scene: string | null;
  entrySource: string | null;
};

type AcquisitionTopSegment = AcquisitionSegmentDimension & {
  eventCount: number;
  acquisitionEventCount: number;
  acquisitionUniqueCount: number;
  activatedUniqueCount: number;
  orderCreatedUniqueCount: number;
  paymentSuccessUniqueCount: number;
  acquisitionToActivationRate: number | null;
  acquisitionToPaymentRate: number | null;
};

function getAcquisitionSegmentKey(segment: AcquisitionSegmentDimension): string {
  return [
    segment.channel || 'unknown',
    segment.campaign || 'none',
    segment.scene || 'none',
    segment.entrySource || 'none',
  ].join('\u001f');
}

function parseAcquisitionSegmentKey(key: string): AcquisitionSegmentDimension {
  const [channel, campaign, scene, entrySource] = key.split('\u001f');
  return {
    channel: channel && channel !== 'unknown' ? channel : null,
    campaign: campaign && campaign !== 'none' ? campaign : null,
    scene: scene && scene !== 'none' ? scene : null,
    entrySource: entrySource && entrySource !== 'none' ? entrySource : null,
  };
}

function hasAcquisitionActivation(events: Set<string> | undefined): boolean {
  if (!events) {
    return false;
  }
  return ACQUISITION_ACTIVATION_EVENT_NAMES.some((eventName) => events.has(eventName));
}

function toUtcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toUtcDay(date);
}

function toRate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

export async function getRetentionOverview(rangeDays: number) {
  const endAt = new Date();
  const startAt = new Date(endAt.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const endDay = toUtcDay(endAt);
  const rows = await prisma.analyticsEvent.findMany({
    where: {
      createdAt: {
        gte: startAt,
      },
      eventName: {
        in: [...RETENTION_EVENT_NAMES],
      },
    },
    select: {
      eventName: true,
      userId: true,
      clientId: true,
      sessionId: true,
      source: true,
      page: true,
      properties: true,
      createdAt: true,
    },
  }) as AnalyticsRetentionRow[];

  const activeDaysByIdentity = new Map<string, Set<string>>();
  const retentionBehaviorCounter = new Map<string, number>();
  let totalIdentifiedEvents = 0;
  let totalUnidentifiedEvents = 0;
  let ignoredOpsEventCount = 0;
  let retentionBehaviorEventCount = 0;

  for (const row of rows) {
    const properties = toRecord(row.properties);
    if (isOpsProductEntrypointSmoke(properties)) {
      ignoredOpsEventCount += 1;
      continue;
    }

    const identity = getAnalyticsFunnelIdentity(row);
    if (!identity) {
      totalUnidentifiedEvents += 1;
      continue;
    }

    totalIdentifiedEvents += 1;
    if (RETENTION_BEHAVIOR_EVENT_NAMES.has(row.eventName)) {
      retentionBehaviorEventCount += 1;
      incrementCounter(retentionBehaviorCounter, row.eventName);
    }
    const activeDays = activeDaysByIdentity.get(identity) || new Set<string>();
    activeDays.add(toUtcDay(row.createdAt));
    activeDaysByIdentity.set(identity, activeDays);
  }

  const cohortIdentitiesByDay = new Map<string, Set<string>>();
  for (const [identity, activeDays] of activeDaysByIdentity.entries()) {
    const firstActiveDay = Array.from(activeDays).sort()[0];
    const cohortIdentities = cohortIdentitiesByDay.get(firstActiveDay) || new Set<string>();
    cohortIdentities.add(identity);
    cohortIdentitiesByDay.set(firstActiveDay, cohortIdentities);
  }

  let d1EligibleCohortUserCount = 0;
  let d1RetainedUserCount = 0;
  let d7EligibleCohortUserCount = 0;
  let d7RetainedUserCount = 0;

  const cohorts = Array.from(cohortIdentitiesByDay.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, identities]) => {
      const cohortUserCount = identities.size;
      const d1Day = addUtcDays(date, 1);
      const d7Day = addUtcDays(date, 7);
      const d1Eligible = d1Day <= endDay;
      const d7Eligible = d7Day <= endDay;
      let cohortD1RetainedUserCount = 0;
      let cohortD7RetainedUserCount = 0;

      for (const identity of identities) {
        const activeDays = activeDaysByIdentity.get(identity) || new Set<string>();
        if (activeDays.has(d1Day)) {
          cohortD1RetainedUserCount += 1;
        }
        if (activeDays.has(d7Day)) {
          cohortD7RetainedUserCount += 1;
        }
      }

      if (d1Eligible) {
        d1EligibleCohortUserCount += cohortUserCount;
        d1RetainedUserCount += cohortD1RetainedUserCount;
      }
      if (d7Eligible) {
        d7EligibleCohortUserCount += cohortUserCount;
        d7RetainedUserCount += cohortD7RetainedUserCount;
      }

      return {
        date,
        cohortUserCount,
        d1Eligible,
        d1RetainedUserCount: d1Eligible ? cohortD1RetainedUserCount : null,
        d1RetentionRate: d1Eligible ? toRate(cohortD1RetainedUserCount, cohortUserCount) : null,
        d7Eligible,
        d7RetainedUserCount: d7Eligible ? cohortD7RetainedUserCount : null,
        d7RetentionRate: d7Eligible ? toRate(cohortD7RetainedUserCount, cohortUserCount) : null,
      };
    });

  const measuredEventCount = totalIdentifiedEvents + totalUnidentifiedEvents;

  return {
    rangeDays,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    retentionDefinition: {
      activeEventNames: [...RETENTION_EVENT_NAMES],
      identityPriority: ['userId', 'clientId', 'sessionId'],
      dayBoundary: 'UTC',
      returnWindows: [1, 7],
      ignoredTrafficKinds: ['ops_product_entrypoint_smoke'],
    },
    summary: {
      cohortUserCount: activeDaysByIdentity.size,
      d1EligibleCohortUserCount,
      d1RetainedUserCount,
      d1RetentionRate: toRate(d1RetainedUserCount, d1EligibleCohortUserCount),
      d7EligibleCohortUserCount,
      d7RetainedUserCount,
      d7RetentionRate: toRate(d7RetainedUserCount, d7EligibleCohortUserCount),
      totalIdentifiedEvents,
      totalUnidentifiedEvents,
      identityCoverageRate: measuredEventCount > 0
        ? Number((totalIdentifiedEvents / measuredEventCount).toFixed(4))
        : null,
      ignoredOpsEventCount,
      retentionBehaviorEventCount,
    },
    breakdown: {
      retentionBehaviorByEvent: toBreakdown(retentionBehaviorCounter),
    },
    cohorts,
  };
}

export async function getActivationOverview(rangeDays: number) {
  const startAt = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.analyticsEvent.findMany({
    where: {
      createdAt: {
        gte: startAt,
      },
      eventName: {
        in: [...ACTIVATION_EVENT_NAMES],
      },
    },
    select: {
      eventName: true,
      userId: true,
      clientId: true,
      sessionId: true,
      source: true,
      page: true,
      properties: true,
      createdAt: true,
    },
  }) as AnalyticsActivationRow[];

  const profileReadyIdentities = new Set<string>();
  const aiQuestionIdentities = new Set<string>();
  const knowledgeOpenIdentities = new Set<string>();
  const valueActionIdentities = new Set<string>();
  const profileStageCounter = new Map<string, number>();
  const valueActionCounter = new Map<string, number>();
  let totalUnidentifiedEvents = 0;

  for (const row of rows) {
    const identity = getAnalyticsFunnelIdentity(row);
    if (!identity) {
      totalUnidentifiedEvents += 1;
      continue;
    }

    if (row.eventName === 'server_lifecycle_profile_ready') {
      profileReadyIdentities.add(identity);
      const properties = toRecord(row.properties);
      incrementCounter(profileStageCounter, typeof properties.lifecycleStage === 'string' ? properties.lifecycleStage : 'unknown');
      continue;
    }

    if (row.eventName === 'app_chat_message_send') {
      aiQuestionIdentities.add(identity);
    } else if (row.eventName === 'app_knowledge_detail_open') {
      knowledgeOpenIdentities.add(identity);
    }
    valueActionIdentities.add(identity);
    incrementCounter(valueActionCounter, row.eventName);
  }

  const activatedIdentities = Array.from(profileReadyIdentities)
    .filter((identity) => valueActionIdentities.has(identity));
  const totalIdentifiedEvents = rows.length - totalUnidentifiedEvents;

  return {
    rangeDays,
    startAt: startAt.toISOString(),
    endAt: new Date().toISOString(),
    activationDefinition: {
      profileReadyEvent: 'server_lifecycle_profile_ready',
      valueActionEvents: ['app_chat_message_send', 'app_knowledge_detail_open'],
      identityPriority: ['userId', 'clientId', 'sessionId'],
    },
    counts: {
      profileReadyUniqueCount: profileReadyIdentities.size,
      aiQuestionUniqueCount: aiQuestionIdentities.size,
      knowledgeOpenUniqueCount: knowledgeOpenIdentities.size,
      valueActionUniqueCount: valueActionIdentities.size,
      activatedUniqueCount: activatedIdentities.length,
      profileToActivationRate: profileReadyIdentities.size > 0
        ? Number((activatedIdentities.length / profileReadyIdentities.size).toFixed(4))
        : null,
      totalIdentifiedEvents,
      totalUnidentifiedEvents,
      identityCoverageRate: rows.length > 0
        ? Number((totalIdentifiedEvents / rows.length).toFixed(4))
        : null,
    },
    breakdown: {
      profileReadyByStage: toBreakdown(profileStageCounter),
      valueActionByEvent: toBreakdown(valueActionCounter),
    },
  };
}

export async function getAcquisitionOverview(rangeDays: number) {
  const startAt = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
  const eventNames = [
    ACQUISITION_EVENT_NAME,
    ...ACQUISITION_ACTIVATION_EVENT_NAMES,
    ...ACQUISITION_PAYMENT_EVENT_NAMES,
    ...ANALYTICS_RETENTION_BEHAVIOR_EVENT_NAMES,
  ];
  const rows = await prisma.analyticsEvent.findMany({
    where: {
      createdAt: {
        gte: startAt,
      },
      eventName: {
        in: eventNames,
      },
    },
    select: {
      eventName: true,
      userId: true,
      clientId: true,
      sessionId: true,
      source: true,
      page: true,
      properties: true,
      createdAt: true,
    },
  }) as AnalyticsAcquisitionRow[];

  const acquisitionIdentities = new Set<string>();
  const activatedIdentities = new Set<string>();
  const orderCreatedIdentities = new Set<string>();
  const paymentSuccessIdentities = new Set<string>();
  const retentionBehaviorIdentities = new Set<string>();
  const eventNamesByIdentity = new Map<string, Set<string>>();
  const byChannel = new Map<string, AcquisitionSegmentStats>();
  const byCampaign = new Map<string, AcquisitionSegmentStats>();
  const byScene = new Map<string, AcquisitionSegmentStats>();
  const byEntrySource = new Map<string, AcquisitionSegmentStats>();
  const topSegmentsByKey = new Map<string, {
    dimension: AcquisitionSegmentDimension;
    stats: AcquisitionSegmentStats;
  }>();
  const acquisitionSegmentsByIdentity = new Map<string, Map<string, AcquisitionSegmentDimension>>();
  let acquisitionEventCount = 0;
  let totalIdentifiedEvents = 0;
  let totalUnidentifiedEvents = 0;
  let ignoredOpsEventCount = 0;

  const sortedRows = rows.slice().sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

  for (const row of sortedRows) {
    const properties = toRecord(row.properties);
    if (isOpsProductEntrypointSmoke(properties)) {
      ignoredOpsEventCount += 1;
      continue;
    }

    const identity = getAnalyticsFunnelIdentity(row);
    if (identity) {
      totalIdentifiedEvents += 1;
      const identityEvents = eventNamesByIdentity.get(identity) || new Set<string>();
      identityEvents.add(row.eventName);
      eventNamesByIdentity.set(identity, identityEvents);
    } else {
      totalUnidentifiedEvents += 1;
    }

    if (row.eventName === ACQUISITION_EVENT_NAME) {
      acquisitionEventCount += 1;
      if (identity) {
        acquisitionIdentities.add(identity);
      }
    }
    if (identity && ACQUISITION_ACTIVATION_EVENT_SET.has(row.eventName)) {
      activatedIdentities.add(identity);
    }
    if (identity && row.eventName === ACQUISITION_ORDER_CREATED_EVENT_NAME) {
      orderCreatedIdentities.add(identity);
    }
    if (identity && row.eventName === ACQUISITION_PAYMENT_SUCCESS_EVENT_NAME) {
      paymentSuccessIdentities.add(identity);
    }
    if (identity && RETENTION_BEHAVIOR_EVENT_NAMES.has(row.eventName)) {
      retentionBehaviorIdentities.add(identity);
    }

    const channel = getAcquisitionChannel(properties);
    const campaign = getAcquisitionCampaign(properties);
    const scene = getAcquisitionScene(properties);
    const entrySource = getAcquisitionEntrySource(properties);

    for (const [key, map] of [
      [channel, byChannel],
      [campaign, byCampaign],
      [scene, byScene],
      [entrySource, byEntrySource],
    ] as const) {
      if (!key) {
        continue;
      }
      const stats = map.get(key) || createAcquisitionSegmentStats();
      updateAcquisitionSegmentStats(stats, row.eventName, identity);
      map.set(key, stats);
    }

    const segmentDimensionsForRow: AcquisitionSegmentDimension[] = [];
    if (row.eventName === ACQUISITION_EVENT_NAME && (channel || campaign || scene || entrySource)) {
      const dimension = {
        channel: channel || null,
        campaign: campaign || null,
        scene: scene || null,
        entrySource: entrySource || null,
      };
      segmentDimensionsForRow.push(dimension);
      if (identity) {
        const identitySegments = acquisitionSegmentsByIdentity.get(identity) || new Map<string, AcquisitionSegmentDimension>();
        identitySegments.set(getAcquisitionSegmentKey(dimension), dimension);
        acquisitionSegmentsByIdentity.set(identity, identitySegments);
      }
    } else if (identity) {
      const identitySegments = acquisitionSegmentsByIdentity.get(identity);
      if (identitySegments) {
        segmentDimensionsForRow.push(...identitySegments.values());
      }
    }

    for (const dimension of segmentDimensionsForRow) {
      const segmentKey = getAcquisitionSegmentKey(dimension);
      const segment = topSegmentsByKey.get(segmentKey) || {
        dimension: parseAcquisitionSegmentKey(segmentKey),
        stats: createAcquisitionSegmentStats(),
      };
      updateAcquisitionSegmentStats(segment.stats, row.eventName, identity);
      topSegmentsByKey.set(segmentKey, segment);
    }
  }

  const activatedFromAcquisitionUniqueCount = Array.from(acquisitionIdentities)
    .filter((identity) => hasAcquisitionActivation(eventNamesByIdentity.get(identity))).length;
  const orderCreatedFromAcquisitionUniqueCount = Array.from(acquisitionIdentities)
    .filter((identity) => eventNamesByIdentity.get(identity)?.has(ACQUISITION_ORDER_CREATED_EVENT_NAME)).length;
  const paymentSuccessFromAcquisitionUniqueCount = Array.from(acquisitionIdentities)
    .filter((identity) => eventNamesByIdentity.get(identity)?.has(ACQUISITION_PAYMENT_SUCCESS_EVENT_NAME)).length;
  const retentionBehaviorFromAcquisitionUniqueCount = Array.from(acquisitionIdentities)
    .filter((identity) => ANALYTICS_RETENTION_BEHAVIOR_EVENT_NAMES.some((eventName) => eventNamesByIdentity.get(identity)?.has(eventName))).length;
  const measuredEventCount = totalIdentifiedEvents + totalUnidentifiedEvents;
  const acquisitionUniqueCount = acquisitionIdentities.size;

  const topAcquisitionSegments: AcquisitionTopSegment[] = Array.from(topSegmentsByKey.values())
    .map(({ dimension, stats }) => {
      const segmentAcquisitionUniqueCount = stats.acquisitionIdentities.size;

      return {
        ...dimension,
        eventCount: stats.eventCount,
        acquisitionEventCount: stats.acquisitionEventCount,
        acquisitionUniqueCount: segmentAcquisitionUniqueCount,
        activatedUniqueCount: stats.activatedIdentities.size,
        orderCreatedUniqueCount: stats.orderCreatedIdentities.size,
        paymentSuccessUniqueCount: stats.paymentSuccessIdentities.size,
        acquisitionToActivationRate: toAcquisitionRate(stats.activatedIdentities.size, segmentAcquisitionUniqueCount),
        acquisitionToPaymentRate: toAcquisitionRate(stats.paymentSuccessIdentities.size, segmentAcquisitionUniqueCount),
      };
    })
    .sort((a, b) => (
      b.paymentSuccessUniqueCount - a.paymentSuccessUniqueCount
      || b.activatedUniqueCount - a.activatedUniqueCount
      || b.acquisitionUniqueCount - a.acquisitionUniqueCount
      || b.acquisitionEventCount - a.acquisitionEventCount
      || `${a.channel || ''}:${a.campaign || ''}:${a.scene || ''}:${a.entrySource || ''}`
        .localeCompare(`${b.channel || ''}:${b.campaign || ''}:${b.scene || ''}:${b.entrySource || ''}`, 'zh-CN')
    ))
    .slice(0, 20);

  return {
    rangeDays,
    startAt: startAt.toISOString(),
    endAt: new Date().toISOString(),
    acquisitionDefinition: {
      acquisitionEvent: ACQUISITION_EVENT_NAME,
      activationEvents: [...ACQUISITION_ACTIVATION_EVENT_NAMES],
      paymentEvents: [...ACQUISITION_PAYMENT_EVENT_NAMES],
      retentionBehaviorEvents: [...ANALYTICS_RETENTION_BEHAVIOR_EVENT_NAMES],
      identityPriority: ['userId', 'clientId', 'sessionId'],
      dimensions: ['channel', 'campaign', 'scene', 'entrySource'],
      ignoredTrafficKinds: ['ops_product_entrypoint_smoke'],
    },
    summary: {
      acquisitionEventCount,
      acquisitionUniqueCount,
      activatedUniqueCount: activatedFromAcquisitionUniqueCount,
      orderCreatedUniqueCount: orderCreatedFromAcquisitionUniqueCount,
      paymentSuccessUniqueCount: paymentSuccessFromAcquisitionUniqueCount,
      retentionBehaviorUniqueCount: retentionBehaviorFromAcquisitionUniqueCount,
      totalActivatedUniqueCount: activatedIdentities.size,
      totalOrderCreatedUniqueCount: orderCreatedIdentities.size,
      totalPaymentSuccessUniqueCount: paymentSuccessIdentities.size,
      totalRetentionBehaviorUniqueCount: retentionBehaviorIdentities.size,
      identifiedEventCount: totalIdentifiedEvents,
      unidentifiedEventCount: totalUnidentifiedEvents,
      identityCoverageRate: measuredEventCount > 0
        ? Number((totalIdentifiedEvents / measuredEventCount).toFixed(4))
        : null,
      ignoredOpsEventCount,
      acquisitionToActivationRate: toAcquisitionRate(activatedFromAcquisitionUniqueCount, acquisitionUniqueCount),
      acquisitionToOrderRate: toAcquisitionRate(orderCreatedFromAcquisitionUniqueCount, acquisitionUniqueCount),
      acquisitionToPaymentRate: toAcquisitionRate(paymentSuccessFromAcquisitionUniqueCount, acquisitionUniqueCount),
      acquisitionToRetentionBehaviorRate: toAcquisitionRate(retentionBehaviorFromAcquisitionUniqueCount, acquisitionUniqueCount),
    },
    breakdown: {
      byChannel: toAcquisitionBreakdown(byChannel).slice(0, 20),
      byCampaign: toAcquisitionBreakdown(byCampaign).slice(0, 20),
      byScene: toAcquisitionBreakdown(byScene).slice(0, 20),
      byEntrySource: toAcquisitionBreakdown(byEntrySource).slice(0, 20),
    },
    topAcquisitionSegments,
  };
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

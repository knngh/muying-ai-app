import { Prisma } from '@prisma/client';
import prisma from '../config/database';

export const ANALYTICS_FUNNEL_STEPS = [
  { eventName: 'mini_program_app_download_click', label: '小程序下载点击' },
  { eventName: 'app_membership_exposure', label: '会员页曝光' },
  { eventName: 'app_order_created', label: '下单创建' },
  { eventName: 'app_payment_success', label: '支付成功' },
  { eventName: 'app_weekly_report_open', label: '周报打开' },
  { eventName: 'app_growth_archive_share', label: '成长档案分享' },
] as const;

export type AnalyticsEventName = typeof ANALYTICS_FUNNEL_STEPS[number]['eventName'];
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

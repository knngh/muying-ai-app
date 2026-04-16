import crypto from 'crypto';
import dayjs from 'dayjs';
import prisma from '../config/database';
import { cache } from './cache.service';
import { AppError, ErrorCodes } from '../middlewares/error.middleware';
import { recordServerAnalyticsEvent } from './analytics.service';
import { resolveLifecycleStage } from '../utils/pregnancy';

const FREE_AI_LIMIT = 3;
const MEMBER_AI_LIMIT = 9999;
const SUBSCRIPTION_CACHE_TTL = 5 * 60 * 1000;
const AI_QUOTA_DEDUP_TTL_MS = 60 * 1000;

type PlanCode = 'monthly' | 'quarterly' | 'yearly';
type MembershipStatus = 'free' | 'active' | 'expired';
type PaymentChannel = 'wechat' | 'alipay';
export type MembershipFeatureCode =
  | 'ai_unlimited'
  | 'continuous_chat'
  | 'weekly_report'
  | 'growth_export'
  | 'stage_circle'
  | 'ad_free';

interface DefaultPlanSeed {
  code: PlanCode;
  name: string;
  price: number;
  originalPrice?: number;
  durationDays: number;
  description: string;
  sortOrder: number;
  badge?: string;
}

export interface MembershipPlanDto {
  id: string;
  code: PlanCode;
  name: string;
  price: number;
  originalPrice?: number;
  durationDays: number;
  monthlyPriceLabel: string;
  badge?: string;
  description: string;
  features: MembershipFeatureCode[];
}

interface RenewalReminder {
  shouldRemind: boolean;
  daysUntilExpiry: number;
  message: string | null;
  urgency: 'normal' | 'warning' | 'urgent';
}

export interface MembershipStatusDto {
  status: MembershipStatus;
  isVip: boolean;
  currentPlanCode: PlanCode | null;
  expireAt: string | null;
  plan: MembershipPlanDto | null;
  aiLimit: number;
  aiUsedToday: number;
  remainingToday: number;
  checkInStreak: number;
  weeklyCompletionRate: number;
  renewalReminder: RenewalReminder | null;
}

export interface QuotaDto {
  date: string;
  aiUsedToday: number;
  aiLimit: number;
  remainingToday: number;
  isUnlimited: boolean;
}

export interface WeeklyReportDto {
  id: string;
  title: string;
  stageLabel: string;
  createdAt: string;
  highlights: string[];
}

export interface PaymentOrderDto {
  orderNo: string;
  amount: number;
  payChannel: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  planCode: PlanCode;
  planName: string;
}

const DEFAULT_PLAN_SEEDS: DefaultPlanSeed[] = [
  {
    code: 'monthly',
    name: '连续包月',
    price: 19.9,
    originalPrice: 29.9,
    durationDays: 30,
    description: '适合先体验问题助手不限次和会员周度报告。',
    sortOrder: 1,
  },
  {
    code: 'quarterly',
    name: '季度会员',
    price: 49.9,
    originalPrice: 59.7,
    durationDays: 90,
    description: '适合孕中期到产后连续使用。',
    sortOrder: 2,
    badge: '省 17%',
  },
  {
    code: 'yearly',
    name: '年度会员',
    price: 148,
    originalPrice: 238.8,
    durationDays: 365,
    description: '覆盖备孕、孕期、产后完整周期。',
    sortOrder: 3,
    badge: '最划算',
  },
];

const PLAN_FEATURES: Record<PlanCode, MembershipFeatureCode[]> = {
  monthly: ['ai_unlimited', 'continuous_chat', 'weekly_report', 'stage_circle'],
  quarterly: ['ai_unlimited', 'continuous_chat', 'weekly_report', 'stage_circle', 'growth_export'],
  yearly: ['ai_unlimited', 'continuous_chat', 'weekly_report', 'growth_export', 'stage_circle', 'ad_free'],
};

function normalizeWeeklyReportTitle(rawTitle?: string | null): string {
  const title = (rawTitle || '').trim();
  if (!title) {
    return '个性化周度报告';
  }

  if (title === 'AI 个性化周报' || title === 'AI个性化周报' || title === '个性化周报') {
    return '个性化周度报告';
  }

  return title;
}

function getTodayDate(): Date {
  return dayjs().startOf('day').toDate();
}

function getWeekStartDate(date = dayjs()): Date {
  const day = date.day();
  const diff = day === 0 ? -6 : 1 - day;
  return date.add(diff, 'day').startOf('day').toDate();
}

function getMembershipCacheKey(userId: string): string {
  return `membership:status:${userId}`;
}

function getQuotaDedupCacheKey(userId: string, requestId: string, fingerprint?: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${requestId}|${fingerprint || ''}`)
    .digest('hex');
  return `quota:dedup:${userId}:${hash}`;
}

function getPlanBadge(code: PlanCode): string | undefined {
  return DEFAULT_PLAN_SEEDS.find((item) => item.code === code)?.badge;
}

function getMonthlyPriceLabel(durationDays: number, price: number): string {
  if (durationDays <= 31) {
    return `¥${price.toFixed(1)} / 月`;
  }

  const months = durationDays / 30;
  return `折合 ¥${(price / months).toFixed(1)} / 月`;
}

function serializePlan(plan: {
  id: bigint;
  code: string;
  name: string;
  price: { toNumber(): number } | number;
  originalPrice: { toNumber(): number } | number | null;
  durationDays: number;
  description: string | null;
  features: unknown;
}): MembershipPlanDto {
  const code = plan.code as PlanCode;
  const price = typeof plan.price === 'number' ? plan.price : plan.price.toNumber();
  const originalPrice = plan.originalPrice == null
    ? undefined
    : typeof plan.originalPrice === 'number'
      ? plan.originalPrice
      : plan.originalPrice.toNumber();
  const configuredFeatures = Array.isArray(plan.features)
    ? plan.features.filter((item): item is MembershipFeatureCode => typeof item === 'string')
    : [];

  return {
    id: plan.id.toString(),
    code,
    name: plan.name,
    price,
    originalPrice,
    durationDays: plan.durationDays,
    monthlyPriceLabel: getMonthlyPriceLabel(plan.durationDays, price),
    badge: getPlanBadge(code),
    description: plan.description || '',
    features: configuredFeatures.length > 0 ? configuredFeatures : PLAN_FEATURES[code],
  };
}

function getStageLabel(user: {
  pregnancyStatus: number;
  dueDate: Date | null;
  babyBirthday: Date | null;
}): string {
  const now = dayjs();
  const lifecycleStage = resolveLifecycleStage(user.pregnancyStatus, user.dueDate, user.babyBirthday);

  if (lifecycleStage === 'pregnant' && user.dueDate) {
    const dueDate = dayjs(user.dueDate);
    const elapsedDays = Math.max(0, 280 - dueDate.diff(now, 'day'));
    const week = Math.max(1, Math.floor(elapsedDays / 7) + 1);
    const day = (elapsedDays % 7) + 1;
    return `孕 ${week} 周 ${day} 天`;
  }

  if (lifecycleStage === 'postpartum' && user.babyBirthday) {
    const ageDays = Math.max(0, now.diff(dayjs(user.babyBirthday), 'day'));
    const month = Math.floor(ageDays / 30);
    const day = ageDays % 30;
    return `宝宝 ${month} 月 ${day} 天`;
  }

  return '备孕阶段';
}

async function computeUsageMetrics(userId: bigint) {
  const today = dayjs().startOf('day');
  const startDate = today.subtract(29, 'day').toDate();
  const endDate = today.endOf('day').toDate();

  const [events, checkins] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        userId,
        deletedAt: null,
        eventDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        eventDate: true,
        status: true,
      },
    }),
    prisma.userCheckin.findMany({
      where: {
        userId,
        checkinDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        checkinDate: true,
      },
    }),
  ]);

  const checkedInDateSet = new Set(
    checkins.map((item) => dayjs(item.checkinDate).format('YYYY-MM-DD')),
  );

  let checkInStreak = 0;
  for (let i = 0; i < 30; i += 1) {
    const date = today.subtract(i, 'day').format('YYYY-MM-DD');
    if (!checkedInDateSet.has(date)) {
      break;
    }
    checkInStreak += 1;
  }

  const weekStart = getWeekStartDate(today);
  const weekEnd = dayjs(weekStart).add(6, 'day').endOf('day').toDate();
  const weeklyEvents = events.filter((item) => item.eventDate >= weekStart && item.eventDate <= weekEnd);
  const weeklyCompleted = weeklyEvents.filter((item) => item.status === 1).length;
  const weeklyCompletionRate = weeklyEvents.length > 0
    ? Math.round((weeklyCompleted / weeklyEvents.length) * 100)
    : 0;

  return {
    checkInStreak,
    weeklyCompletionRate,
  };
}

export async function ensureDefaultSubscriptionPlans(): Promise<void> {
  const count = await prisma.subscriptionPlan.count();
  if (count > 0) {
    return;
  }

  await prisma.subscriptionPlan.createMany({
    data: DEFAULT_PLAN_SEEDS.map((plan) => ({
      name: plan.name,
      code: plan.code,
      price: plan.price,
      originalPrice: plan.originalPrice,
      durationDays: plan.durationDays,
      description: plan.description,
      features: PLAN_FEATURES[plan.code],
      sortOrder: plan.sortOrder,
      isActive: 1,
    })),
  });
}

export async function getSubscriptionPlans(): Promise<MembershipPlanDto[]> {
  await ensureDefaultSubscriptionPlans();

  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: 1 },
    orderBy: [
      { sortOrder: 'asc' },
      { durationDays: 'asc' },
    ],
  });

  return plans.map((plan) => serializePlan(plan));
}

async function getResolvedSubscriptionRecord(userId: string) {
  const cacheKey = getMembershipCacheKey(userId);
  const cached = cache.get<{
    status: MembershipStatus;
    subscription: {
      id: bigint;
      expireAt: Date;
      planId: bigint;
      planCode: PlanCode;
      plan: MembershipPlanDto;
    } | null;
  }>(cacheKey);

  if (cached) {
    return cached;
  }

  const userIdBigInt = BigInt(userId);
  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      userId: userIdBigInt,
      status: 'active',
    },
    include: {
      plan: true,
    },
    orderBy: { expireAt: 'desc' },
  });

  if (activeSubscription && dayjs(activeSubscription.expireAt).isAfter(dayjs())) {
    const resolved = {
      status: 'active' as MembershipStatus,
      subscription: {
        id: activeSubscription.id,
        expireAt: activeSubscription.expireAt,
        planId: activeSubscription.planId,
        planCode: activeSubscription.plan.code as PlanCode,
        plan: serializePlan(activeSubscription.plan),
      },
    };
    cache.set(cacheKey, resolved, SUBSCRIPTION_CACHE_TTL);
    return resolved;
  }

  if (activeSubscription) {
    await prisma.subscription.update({
      where: { id: activeSubscription.id },
      data: { status: 'expired' },
    });
  }

  const latestSubscription = await prisma.subscription.findFirst({
    where: { userId: userIdBigInt },
    include: { plan: true },
    orderBy: { expireAt: 'desc' },
  });

  const resolved = latestSubscription
    ? {
      status: 'expired' as MembershipStatus,
      subscription: {
        id: latestSubscription.id,
        expireAt: latestSubscription.expireAt,
        planId: latestSubscription.planId,
        planCode: latestSubscription.plan.code as PlanCode,
        plan: serializePlan(latestSubscription.plan),
      },
    }
    : {
      status: 'free' as MembershipStatus,
      subscription: null,
    };

  cache.set(cacheKey, resolved, SUBSCRIPTION_CACHE_TTL);
  return resolved;
}

function invalidateMembershipCache(userId: string) {
  cache.delete(getMembershipCacheKey(userId));
}

async function ensureDailyQuotaRecord(userId: string, isVip: boolean) {
  const userIdBigInt = BigInt(userId);
  const aiLimit = isVip ? MEMBER_AI_LIMIT : FREE_AI_LIMIT;

  await prisma.$executeRaw`
    INSERT INTO user_daily_quotas (userId, quotaDate, aiUsed, aiLimit, createdAt, updatedAt)
    VALUES (${userIdBigInt}, CURDATE(), 0, ${aiLimit}, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      aiLimit = VALUES(aiLimit),
      updatedAt = NOW()
  `;

  const [quota] = await prisma.$queryRaw<Array<{
    id: bigint;
    userId: bigint;
    quotaDate: Date;
    aiUsed: number;
    aiLimit: number;
  }>>`
    SELECT id, userId, quotaDate, aiUsed, aiLimit
    FROM user_daily_quotas
    WHERE userId = ${userIdBigInt}
      AND quotaDate = CURDATE()
    ORDER BY id DESC
    LIMIT 1
  `;

  if (!quota) {
    throw new AppError('获取今日额度失败', ErrorCodes.SERVER_ERROR, 500);
  }

  return quota;
}

export async function getTodayQuota(userId: string): Promise<QuotaDto> {
  const subscription = await getResolvedSubscriptionRecord(userId);
  const quota = await ensureDailyQuotaRecord(userId, subscription.status === 'active');
  const unlimited = quota.aiLimit >= MEMBER_AI_LIMIT;

  return {
    date: dayjs(quota.quotaDate).format('YYYY-MM-DD'),
    aiUsedToday: quota.aiUsed,
    aiLimit: quota.aiLimit,
    remainingToday: unlimited ? MEMBER_AI_LIMIT : Math.max(quota.aiLimit - quota.aiUsed, 0),
    isUnlimited: unlimited,
  };
}

export async function consumeAiQuota(
  userId: string,
  options?: {
    requestId?: string;
    fingerprint?: string;
  },
) {
  const dedupKey = options?.requestId
    ? getQuotaDedupCacheKey(userId, options.requestId, options.fingerprint)
    : null;

  if (dedupKey) {
    const cachedResult = cache.get<{
      allowed: boolean;
      quota: QuotaDto;
    }>(dedupKey);
    if (cachedResult) {
      return cachedResult;
    }
  }

  const subscription = await getResolvedSubscriptionRecord(userId);
  const quota = await ensureDailyQuotaRecord(userId, subscription.status === 'active');
  const unlimited = subscription.status === 'active';

  if (!unlimited && quota.aiUsed >= quota.aiLimit) {
    const result = {
      allowed: false,
      quota: {
        date: dayjs(quota.quotaDate).format('YYYY-MM-DD'),
        aiUsedToday: quota.aiUsed,
        aiLimit: quota.aiLimit,
        remainingToday: 0,
        isUnlimited: false,
      } satisfies QuotaDto,
    };
    if (dedupKey) {
      cache.set(dedupKey, result, AI_QUOTA_DEDUP_TTL_MS);
    }
    return result;
  }

  // 原子条件更新：只有 aiUsed < aiLimit 时才 increment，防止并发超限
  const affected = unlimited
    ? await prisma.$executeRaw`
        UPDATE user_daily_quotas
        SET aiUsed = aiUsed + 1, updatedAt = NOW()
        WHERE id = ${quota.id}
      `
    : await prisma.$executeRaw`
        UPDATE user_daily_quotas
        SET aiUsed = aiUsed + 1, updatedAt = NOW()
        WHERE id = ${quota.id} AND aiUsed < aiLimit
      `;

  if (!unlimited && affected === 0) {
    const result = {
      allowed: false,
      quota: {
        date: dayjs(quota.quotaDate).format('YYYY-MM-DD'),
        aiUsedToday: quota.aiLimit,
        aiLimit: quota.aiLimit,
        remainingToday: 0,
        isUnlimited: false,
      } satisfies QuotaDto,
    };
    if (dedupKey) {
      cache.set(dedupKey, result, AI_QUOTA_DEDUP_TTL_MS);
    }
    return result;
  }

  const updated = await prisma.userDailyQuota.findUniqueOrThrow({
    where: { id: quota.id },
  });

  const result = {
    allowed: true,
    quota: {
      date: dayjs(updated.quotaDate).format('YYYY-MM-DD'),
      aiUsedToday: updated.aiUsed,
      aiLimit: updated.aiLimit,
      remainingToday: unlimited ? MEMBER_AI_LIMIT : Math.max(updated.aiLimit - updated.aiUsed, 0),
      isUnlimited: unlimited,
    } satisfies QuotaDto,
  };
  if (dedupKey) {
    cache.set(dedupKey, result, AI_QUOTA_DEDUP_TTL_MS);
  }
  return result;
}

function computeRenewalReminder(
  status: MembershipStatus,
  expireAt: Date | null,
): RenewalReminder | null {
  if (status !== 'active' || !expireAt) {
    return null;
  }

  const daysUntilExpiry = dayjs(expireAt).diff(dayjs(), 'day');

  if (daysUntilExpiry > 7) {
    return null;
  }

  if (daysUntilExpiry <= 1) {
    return {
      shouldRemind: true,
      daysUntilExpiry,
      message: '您的会员明天就要到期啦，续费可继续享受专属权益',
      urgency: 'urgent',
    };
  }

  if (daysUntilExpiry <= 3) {
    return {
      shouldRemind: true,
      daysUntilExpiry,
      message: `您的会员将在${daysUntilExpiry}天后到期，记得及时续费哦`,
      urgency: 'warning',
    };
  }

  return {
    shouldRemind: true,
    daysUntilExpiry,
    message: `您的会员将在${daysUntilExpiry}天后到期`,
    urgency: 'normal',
  };
}

export async function getMembershipStatus(userId: string): Promise<MembershipStatusDto> {
  const [subscription, quota, metrics] = await Promise.all([
    getResolvedSubscriptionRecord(userId),
    getTodayQuota(userId),
    computeUsageMetrics(BigInt(userId)),
  ]);

  const renewalReminder = computeRenewalReminder(
    subscription.status,
    subscription.subscription?.expireAt ?? null,
  );

  return {
    status: subscription.status,
    isVip: subscription.status === 'active',
    currentPlanCode: subscription.subscription?.planCode ?? null,
    expireAt: subscription.subscription?.expireAt.toISOString() ?? null,
    plan: subscription.subscription?.plan ?? null,
    aiLimit: quota.aiLimit,
    aiUsedToday: quota.aiUsedToday,
    remainingToday: quota.remainingToday,
    checkInStreak: metrics.checkInStreak,
    weeklyCompletionRate: metrics.weeklyCompletionRate,
    renewalReminder,
  };
}

export async function checkFeatureAvailability(userId: string, feature: MembershipFeatureCode) {
  const status = await getMembershipStatus(userId);
  const features = status.plan?.features || [];
  const allowed = status.isVip && features.includes(feature);

  return {
    allowed,
    feature,
    upgradeUrl: '/membership',
    status,
  };
}

function generateOrderNo() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SUB${dayjs().format('YYYYMMDDHHmmss')}${random}`;
}

async function getPlanByCode(planCode: PlanCode) {
  await ensureDefaultSubscriptionPlans();
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { code: planCode },
  });

  if (!plan || plan.isActive !== 1) {
    throw new AppError('套餐不存在', ErrorCodes.PARAM_ERROR, 404);
  }

  return plan;
}

export async function createPaymentOrder(userId: string, planCode: PlanCode, payChannel: 'wechat' | 'alipay') {
  const plan = await getPlanByCode(planCode);
  const orderNo = generateOrderNo();

  const order = await prisma.paymentOrder.create({
    data: {
      userId: BigInt(userId),
      planId: plan.id,
      orderNo,
      amount: plan.price,
      payChannel,
      status: 'pending',
    },
    include: {
      plan: true,
    },
  });

  await recordServerAnalyticsEvent('app_order_created', {
    userId,
    page: 'MembershipScreen',
    properties: {
      orderNo: order.orderNo,
      planCode: order.plan.code,
      payChannel,
      amount: order.amount.toNumber(),
    },
  });

  return {
    orderNo: order.orderNo,
    amount: order.amount.toNumber(),
    payChannel: order.payChannel,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    paidAt: null,
    planCode: order.plan.code as PlanCode,
    planName: order.plan.name,
    mockPaymentPayload: {
      orderNo: order.orderNo,
      payChannel,
      autoConfirm: true,
    },
  };
}

async function activateSubscriptionForOrder(input: {
  orderNo: string;
  tradeNo?: string;
  userId?: string;
  expectedPayChannel?: PaymentChannel;
  amount?: number;
}) {
  const order = await prisma.paymentOrder.findUnique({
    where: { orderNo: input.orderNo },
    include: { plan: true },
  });

  if (!order) {
    throw new AppError('订单不存在', ErrorCodes.PARAM_ERROR, 404);
  }

  if (input.userId && order.userId.toString() !== input.userId) {
    throw new AppError('无权操作该订单', ErrorCodes.NO_PERMISSION, 403);
  }

  if (input.expectedPayChannel && order.payChannel !== input.expectedPayChannel) {
    throw new AppError('支付渠道不匹配', ErrorCodes.PARAM_ERROR, 400);
  }

  if (input.amount != null) {
    const orderAmount = order.amount.toNumber();
    if (Math.abs(orderAmount - input.amount) > 0.01) {
      throw new AppError('支付金额不匹配', ErrorCodes.PARAM_ERROR, 400);
    }
  }

  if (order.status === 'paid') {
    invalidateMembershipCache(order.userId.toString());
    return order;
  }

  await prisma.$transaction(async (tx) => {
    // 在事务内重新检查订单状态，防止并发回调重复激活
    const lockedOrder = await tx.paymentOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    if (lockedOrder.status === 'paid') {
      return;
    }

    const now = dayjs();
    const existing = await tx.subscription.findFirst({
      where: {
        userId: order.userId,
        status: 'active',
      },
      orderBy: { expireAt: 'desc' },
    });

    const baseStart = existing && dayjs(existing.expireAt).isAfter(now)
      ? dayjs(existing.expireAt)
      : now;
    const nextExpireAt = baseStart.add(order.plan.durationDays, 'day').toDate();

    if (existing) {
      await tx.subscription.update({
        where: { id: existing.id },
        data: {
          planId: order.planId,
          startAt: existing.startAt,
          expireAt: nextExpireAt,
          status: 'active',
        },
      });
    } else {
      await tx.subscription.create({
        data: {
          userId: order.userId,
          planId: order.planId,
          status: 'active',
          startAt: now.toDate(),
          expireAt: nextExpireAt,
          autoRenew: 1,
        },
      });
    }

    await tx.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        tradeNo: input.tradeNo || order.tradeNo || `MOCK-${order.orderNo}`,
        paidAt: new Date(),
      },
    });
  });

  invalidateMembershipCache(order.userId.toString());
  await ensureDailyQuotaRecord(order.userId.toString(), true);

  await recordServerAnalyticsEvent('app_payment_success', {
    userId: order.userId.toString(),
    page: 'MembershipScreen',
    properties: {
      orderNo: order.orderNo,
      planCode: order.plan.code,
      payChannel: order.payChannel,
      amount: order.amount.toNumber(),
      tradeNo: input.tradeNo || order.tradeNo || `MOCK-${order.orderNo}`,
    },
  });

  return prisma.paymentOrder.findUniqueOrThrow({
    where: { orderNo: input.orderNo },
    include: { plan: true },
  });
}

export async function confirmWechatPayment(userId: string, orderNo: string, tradeNo?: string) {
  const order = await activateSubscriptionForOrder({
    userId,
    orderNo,
    tradeNo,
    expectedPayChannel: 'wechat',
  });
  return {
    orderNo: order.orderNo,
    status: order.status,
    paidAt: order.paidAt?.toISOString() ?? null,
  };
}

export async function confirmAlipayPayment(userId: string, orderNo: string, tradeNo?: string) {
  const order = await activateSubscriptionForOrder({
    userId,
    orderNo,
    tradeNo,
    expectedPayChannel: 'alipay',
  });
  return {
    orderNo: order.orderNo,
    status: order.status,
    paidAt: order.paidAt?.toISOString() ?? null,
  };
}

export async function confirmWechatPaymentCallback(orderNo: string, tradeNo?: string, amount?: number) {
  const order = await activateSubscriptionForOrder({
    orderNo,
    tradeNo,
    amount,
    expectedPayChannel: 'wechat',
  });
  return {
    orderNo: order.orderNo,
    status: order.status,
    paidAt: order.paidAt?.toISOString() ?? null,
  };
}

export async function confirmAlipayPaymentCallback(orderNo: string, tradeNo?: string, amount?: number) {
  const order = await activateSubscriptionForOrder({
    orderNo,
    tradeNo,
    amount,
    expectedPayChannel: 'alipay',
  });
  return {
    orderNo: order.orderNo,
    status: order.status,
    paidAt: order.paidAt?.toISOString() ?? null,
  };
}

export async function getPaymentOrder(userId: string, orderNo: string): Promise<PaymentOrderDto> {
  const order = await prisma.paymentOrder.findUnique({
    where: { orderNo },
    include: { plan: true },
  });

  if (!order) {
    throw new AppError('订单不存在', ErrorCodes.PARAM_ERROR, 404);
  }

  if (order.userId.toString() !== userId) {
    throw new AppError('无权查看该订单', ErrorCodes.NO_PERMISSION, 403);
  }

  return {
    orderNo: order.orderNo,
    amount: order.amount.toNumber(),
    payChannel: order.payChannel,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    planCode: order.plan.code as PlanCode,
    planName: order.plan.name,
  };
}

function buildWeeklyHighlights(stageLabel: string, metrics: { checkInStreak: number; weeklyCompletionRate: number }) {
  return [
    `当前阶段：${stageLabel}，这周更适合围绕睡眠、饮食和固定节律做微调。`,
    metrics.weeklyCompletionRate > 0
      ? `本周日历完成率 ${metrics.weeklyCompletionRate}%，优先补齐最关键的一项待办。`
      : '本周还没有形成稳定打卡，先从一个最容易坚持的小目标开始。',
    metrics.checkInStreak > 0
      ? `你已经连续打卡 ${metrics.checkInStreak} 天，继续保持节奏比一次做很多更重要。`
      : '今天适合完成一次简短记录或提问，为后续周报积累更完整的上下文。',
  ];
}

function serializeWeeklyReport(report: {
  id: bigint;
  stageInfo: string;
  createdAt: Date;
  content: unknown;
}): WeeklyReportDto {
  const content = report.content && typeof report.content === 'object'
    ? report.content as Record<string, unknown>
    : {};
  const highlights = Array.isArray(content.highlights)
    ? content.highlights.filter((item): item is string => typeof item === 'string')
    : [];
  const title = normalizeWeeklyReportTitle(
    typeof content.title === 'string' ? content.title : null,
  );

  return {
    id: report.id.toString(),
    title,
    stageLabel: report.stageInfo,
    createdAt: report.createdAt.toISOString(),
    highlights,
  };
}

export async function generateWeeklyReport(userId: string): Promise<WeeklyReportDto> {
  const status = await getMembershipStatus(userId);
  if (!status.isVip) {
    throw new AppError('该功能仅会员可用', ErrorCodes.NO_PERMISSION, 403);
  }

  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: {
      pregnancyStatus: true,
      dueDate: true,
      babyBirthday: true,
    },
  });

  if (!user) {
    throw new AppError('用户不存在', ErrorCodes.USER_NOT_FOUND, 404);
  }

  const weekStart = getWeekStartDate();
  const existing = await prisma.aiWeeklyReport.findUnique({
    where: {
      userId_weekStart: {
        userId: BigInt(userId),
        weekStart,
      },
    },
  });

  if (existing) {
    return serializeWeeklyReport(existing);
  }

  const stageLabel = getStageLabel(user);
  const highlights = buildWeeklyHighlights(stageLabel, {
    checkInStreak: status.checkInStreak,
    weeklyCompletionRate: status.weeklyCompletionRate,
  });

  const report = await prisma.aiWeeklyReport.create({
    data: {
      userId: BigInt(userId),
      weekStart,
      stageInfo: stageLabel,
      content: {
        title: '个性化周度报告',
        highlights,
      },
    },
  });

  return serializeWeeklyReport(report);
}

export async function getLatestWeeklyReport(userId: string): Promise<WeeklyReportDto> {
  const latest = await prisma.aiWeeklyReport.findFirst({
    where: { userId: BigInt(userId) },
    orderBy: { weekStart: 'desc' },
  });

  if (latest) {
    return serializeWeeklyReport(latest);
  }

  return generateWeeklyReport(userId);
}

export async function getWeeklyReportList(userId: string): Promise<WeeklyReportDto[]> {
  const status = await getMembershipStatus(userId);
  if (!status.isVip) {
    throw new AppError('该功能仅会员可用', ErrorCodes.NO_PERMISSION, 403);
  }

  const reports = await prisma.aiWeeklyReport.findMany({
    where: { userId: BigInt(userId) },
    orderBy: { weekStart: 'desc' },
    take: 12,
  });

  if (reports.length === 0) {
    return [await generateWeeklyReport(userId)];
  }

  return reports.map((report) => serializeWeeklyReport(report));
}

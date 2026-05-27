import dayjs from 'dayjs';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { AppError, ErrorCodes } from '../middlewares/error.middleware';
import { cache } from './cache.service';

// 积分奖励档位
const BONUS_TIERS = [
  { streak: 30, bonus: 25 },
  { streak: 14, bonus: 15 },
  { streak: 7, bonus: 10 },
  { streak: 3, bonus: 5 },
] as const;

const BASE_POINTS = 5;

interface CheckinResult {
  checkinDate: string;
  streakCount: number;
  consecutiveDays: number;
  streakDates: string[];
  totalDays: number;
  checkedInToday: boolean;
  pointsAwarded: number;
  pointsEarned: number;
  totalPoints: number;
  nextBonusAt: number | null;
  nextBonusPoints: number | null;
  alreadyCheckedIn?: boolean;
}

interface CheckinStatus {
  checkedInToday: boolean;
  currentStreak: number;
  consecutiveDays: number;
  streakDates: string[];
  totalDays: number;
  totalPoints: number;
  monthlyCheckins: string[];
  nextBonusAt: number | null;
  nextBonusPoints: number | null;
}

function computeBonus(streak: number): number {
  for (const tier of BONUS_TIERS) {
    if (streak >= tier.streak) {
      return tier.bonus;
    }
  }
  return 0;
}

function computeNextBonus(streak: number): { nextBonusAt: number | null; nextBonusPoints: number | null } {
  // Find the next tier the user hasn't reached yet
  for (let i = BONUS_TIERS.length - 1; i >= 0; i--) {
    const tier = BONUS_TIERS[i];
    if (streak < tier.streak) {
      return { nextBonusAt: tier.streak, nextBonusPoints: tier.bonus };
    }
  }
  return { nextBonusAt: null, nextBonusPoints: null };
}

function buildStreakDatesEndingAt(date: dayjs.Dayjs, streakCount: number): string[] {
  const dateCount = Math.min(Math.max(streakCount, 0), 60);

  return Array.from({ length: dateCount }, (_, index) => (
    date.subtract(dateCount - index - 1, 'day').format('YYYY-MM-DD')
  ));
}

function toDbDate(date: dayjs.Dayjs): Date {
  return new Date(Date.UTC(date.year(), date.month(), date.date()));
}

function getDbDateCandidates(date: dayjs.Dayjs): Date[] {
  const canonicalDate = toDbDate(date);
  const legacyDateKey = date.toDate().toISOString().slice(0, 10);
  const legacyDate = toDbDate(dayjs(legacyDateKey));
  const uniqueDates = new Map<string, Date>();

  for (const candidate of [canonicalDate, legacyDate]) {
    uniqueDates.set(candidate.toISOString().slice(0, 10), candidate);
  }

  return Array.from(uniqueDates.values());
}

async function findCheckinForBusinessDay(userId: bigint, date: dayjs.Dayjs) {
  return prisma.userCheckin.findFirst({
    where: {
      userId,
      checkinDate: { in: getDbDateCandidates(date) },
      createdAt: {
        gte: date.startOf('day').toDate(),
        lte: date.endOf('day').toDate(),
      },
    },
    select: { id: true, checkinDate: true, streakCount: true, createdAt: true },
    orderBy: { checkinDate: 'desc' },
  });
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function performCheckin(userId: string): Promise<CheckinResult> {
  const userIdBigInt = BigInt(userId);
  const today = dayjs().startOf('day');
  const todayString = today.format('YYYY-MM-DD');

  const existingCheckin = await findCheckinForBusinessDay(userIdBigInt, today);

  if (existingCheckin) {
    return buildAlreadyCheckedInResult(userId, todayString);
  }

  // Compute streak before creating today; unique create below prevents concurrent double awards.
  const yesterdayCheckin = await findCheckinForBusinessDay(userIdBigInt, today.subtract(1, 'day'));
  const streakCount = Math.max(yesterdayCheckin?.streakCount ?? 0, 0) + 1;
  const bonus = computeBonus(streakCount);
  const pointsAwarded = BASE_POINTS + bonus;

  let result: { totalPoints: number; totalDays: number };

  try {
    result = await prisma.$transaction(async (tx) => {
      await tx.userCheckin.create({
        data: {
          userId: userIdBigInt,
          checkinDate: toDbDate(today),
          streakCount,
          pointsAwarded,
        },
      });

      const user = await tx.user.update({
        where: { id: userIdBigInt },
        data: {
          totalPoints: {
            increment: pointsAwarded,
          },
        },
        select: { totalPoints: true },
      });

      await tx.userPointsLog.create({
        data: {
          userId: userIdBigInt,
          points: pointsAwarded,
          balance: user.totalPoints,
          source: 'checkin',
          sourceId: todayString,
          description: streakCount > 1
            ? `连续签到第${streakCount}天，获得${pointsAwarded}积分`
            : `签到获得${pointsAwarded}积分`,
        },
      });

      const totalDays = await tx.userCheckin.count({
        where: { userId: userIdBigInt },
      });

      return {
        totalPoints: user.totalPoints,
        totalDays,
      };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return buildAlreadyCheckedInResult(userId, todayString);
    }
    throw error;
  }

  const { nextBonusAt, nextBonusPoints } = computeNextBonus(streakCount);

  return {
    checkinDate: todayString,
    streakCount,
    consecutiveDays: streakCount,
    streakDates: buildStreakDatesEndingAt(today, streakCount),
    totalDays: result.totalDays,
    checkedInToday: true,
    pointsAwarded,
    pointsEarned: pointsAwarded,
    totalPoints: result.totalPoints,
    nextBonusAt,
    nextBonusPoints,
  };
}

async function buildAlreadyCheckedInResult(userId: string, todayString: string): Promise<CheckinResult> {
  const status = await getCheckinStatus(userId);

  return {
    checkinDate: todayString,
    streakCount: status.currentStreak,
    consecutiveDays: status.consecutiveDays,
    streakDates: status.streakDates,
    totalDays: status.totalDays,
    checkedInToday: true,
    pointsAwarded: 0,
    pointsEarned: 0,
    totalPoints: status.totalPoints,
    nextBonusAt: status.nextBonusAt,
    nextBonusPoints: status.nextBonusPoints,
    alreadyCheckedIn: true,
  };
}

export async function getCheckinStatus(userId: string): Promise<CheckinStatus> {
  const userIdBigInt = BigInt(userId);
  const today = dayjs().startOf('day');

  // Check if already checked in today
  const todayCheckin = await findCheckinForBusinessDay(userIdBigInt, today);

  const checkedInToday = !!todayCheckin;
  const effectiveStreak = todayCheckin
    ? {
      count: Math.max(todayCheckin.streakCount, 1),
      dates: buildStreakDatesEndingAt(today, Math.max(todayCheckin.streakCount, 1)),
    }
    : { count: 0, dates: [] };

  // Monthly checkins calendar
  const monthStart = today.startOf('month');
  const monthEnd = today.endOf('month');
  const monthStartKey = monthStart.format('YYYY-MM-DD');
  const monthEndKey = monthEnd.format('YYYY-MM-DD');

  const monthlyRecords = await prisma.userCheckin.findMany({
    where: {
      userId: userIdBigInt,
      checkinDate: {
        gte: toDbDate(monthStart.subtract(1, 'day')),
        lte: toDbDate(monthEnd),
      },
    },
    select: { checkinDate: true, createdAt: true },
    orderBy: { checkinDate: 'asc' },
  });

  const monthlyCheckins = Array.from(new Set(
    monthlyRecords
      .map((r) => dayjs(r.createdAt || r.checkinDate).format('YYYY-MM-DD'))
      .filter((date) => date >= monthStartKey && date <= monthEndKey),
  )).sort();

  // Get points balance
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userIdBigInt },
    select: { totalPoints: true },
  });

  // Total checkin days (all time)
  const totalDays = await prisma.userCheckin.count({
    where: { userId: userIdBigInt },
  });

  const { nextBonusAt, nextBonusPoints } = computeNextBonus(effectiveStreak.count);

  return {
    checkedInToday,
    currentStreak: effectiveStreak.count,
    consecutiveDays: effectiveStreak.count,
    streakDates: effectiveStreak.dates,
    totalDays,
    totalPoints: user.totalPoints,
    monthlyCheckins,
    nextBonusAt,
    nextBonusPoints,
  };
}

// ==================== 积分流水查询 ====================

export async function getPointsLogs(userId: string, page: number, pageSize: number) {
  const userIdBigInt = BigInt(userId);
  const skip = (page - 1) * pageSize;

  const [list, total] = await Promise.all([
    prisma.userPointsLog.findMany({
      where: { userId: userIdBigInt },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.userPointsLog.count({ where: { userId: userIdBigInt } }),
  ]);

  return {
    list: list.map((log) => ({
      id: log.id.toString(),
      points: log.points,
      balance: log.balance,
      source: log.source,
      sourceId: log.sourceId,
      description: log.description,
      createdAt: log.createdAt,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// ==================== 积分兑换会员 ====================

const POINTS_PER_DAY = 100;
const REDEEM_MIN = 100;
const REDEEM_MAX = 3000;

interface RedeemResult {
  pointsSpent: number;
  daysAdded: number;
  newExpireAt: Date;
  remainingPoints: number;
}

export async function redeemPoints(userId: string, points: number): Promise<RedeemResult> {
  if (!Number.isInteger(points) || points % POINTS_PER_DAY !== 0) {
    throw new AppError(`兑换积分必须是${POINTS_PER_DAY}的整数倍`, ErrorCodes.PARAM_ERROR, 400);
  }
  if (points < REDEEM_MIN || points > REDEEM_MAX) {
    throw new AppError(`兑换范围：${REDEEM_MIN}~${REDEEM_MAX}积分`, ErrorCodes.PARAM_ERROR, 400);
  }

  const userIdBigInt = BigInt(userId);
  const daysAdded = points / POINTS_PER_DAY;

  // 原子扣减余额
  const affected = await prisma.$executeRaw`
    UPDATE users SET totalPoints = totalPoints - ${points}
    WHERE id = ${userIdBigInt} AND totalPoints >= ${points}
  `;
  if (affected === 0) {
    throw new AppError('积分余额不足', ErrorCodes.PARAM_ERROR, 400);
  }

  // 获取扣减后余额
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userIdBigInt },
    select: { totalPoints: true },
  });

  // 写积分流水（负数）
  await prisma.userPointsLog.create({
    data: {
      userId: userIdBigInt,
      points: -points,
      balance: user.totalPoints,
      source: 'redeem',
      sourceId: `redeem-${Date.now()}`,
      description: `兑换${daysAdded}天会员，消耗${points}积分`,
    },
  });

  // 延长/创建订阅
  const now = dayjs();
  const existing = await prisma.subscription.findFirst({
    where: { userId: userIdBigInt, status: 'active' },
    orderBy: { expireAt: 'desc' },
  });

  const baseStart = existing && dayjs(existing.expireAt).isAfter(now)
    ? dayjs(existing.expireAt)
    : now;
  const newExpireAt = baseStart.add(daysAdded, 'day').toDate();

  // 获取默认 plan（月卡）
  const defaultPlan = await prisma.subscriptionPlan.findFirst({
    where: { durationDays: 30 },
  });
  const planId = defaultPlan ? defaultPlan.id : BigInt(1);

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: { expireAt: newExpireAt, status: 'active' },
    });
  } else {
    await prisma.subscription.create({
      data: {
        userId: userIdBigInt,
        planId,
        status: 'active',
        startAt: now.toDate(),
        expireAt: newExpireAt,
        autoRenew: 0,
      },
    });
  }

  // 清除会员缓存
  cache.delete(`membership:status:${userId}`);

  return {
    pointsSpent: points,
    daysAdded,
    newExpireAt,
    remainingPoints: user.totalPoints,
  };
}

// ==================== 行为积分 ====================

const BEHAVIOR_CONFIG = {
  post: { points: 3, dailyMax: 3 },
  read: { points: 1, dailyMax: 5 },
  todo: { points: 2, dailyMax: 3 },
} as const;

type BehaviorSource = keyof typeof BEHAVIOR_CONFIG;

export async function awardBehaviorPoints(
  userId: string,
  source: BehaviorSource,
  sourceId: string,
): Promise<{ awarded: boolean; points: number; totalPoints: number }> {
  const userIdBigInt = BigInt(userId);
  const config = BEHAVIOR_CONFIG[source];
  const todayStart = dayjs().startOf('day').toDate();

  // 查今日该 source 已获积分次数
  const todayCount = await prisma.userPointsLog.count({
    where: {
      userId: userIdBigInt,
      source,
      createdAt: { gte: todayStart },
    },
  });

  if (todayCount >= config.dailyMax) {
    return { awarded: false, points: 0, totalPoints: 0 };
  }

  // 原子加积分
  await prisma.$executeRaw`
    UPDATE users SET totalPoints = totalPoints + ${config.points}
    WHERE id = ${userIdBigInt}
  `;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userIdBigInt },
    select: { totalPoints: true },
  });

  // 写流水
  await prisma.userPointsLog.create({
    data: {
      userId: userIdBigInt,
      points: config.points,
      balance: user.totalPoints,
      source,
      sourceId,
      description: source === 'post' ? '发帖奖励' : source === 'read' ? '阅读奖励' : '完成待办奖励',
    },
  });

  return { awarded: true, points: config.points, totalPoints: user.totalPoints };
}

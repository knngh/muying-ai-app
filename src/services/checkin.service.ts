import dayjs from 'dayjs';
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
  pointsAwarded: number;
  totalPoints: number;
  nextBonusAt: number | null;
  nextBonusPoints: number | null;
}

interface CheckinStatus {
  checkedInToday: boolean;
  currentStreak: number;
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

async function computeStreak(userId: bigint, includeToday: boolean): Promise<number> {
  const today = dayjs().startOf('day');
  const startDate = includeToday ? today : today.subtract(1, 'day');

  // Fetch recent checkins ordered desc to count consecutive days
  const checkins = await prisma.userCheckin.findMany({
    where: {
      userId,
      checkinDate: { lte: startDate.toDate() },
    },
    orderBy: { checkinDate: 'desc' },
    take: 60, // enough to cover max streak window
    select: { checkinDate: true },
  });

  let streak = 0;
  let expectedDate = startDate;

  for (const checkin of checkins) {
    const checkinDay = dayjs(checkin.checkinDate).startOf('day');
    if (checkinDay.isSame(expectedDate, 'day')) {
      streak++;
      expectedDate = expectedDate.subtract(1, 'day');
    } else {
      break;
    }
  }

  return streak;
}

export async function performCheckin(userId: string): Promise<CheckinResult> {
  const userIdBigInt = BigInt(userId);
  const today = dayjs().startOf('day').toDate();

  // Upsert with unique constraint — affected=0 means already checked in
  const affected = await prisma.$executeRaw`
    INSERT INTO user_checkins (userId, checkinDate, streakCount, pointsAwarded, createdAt)
    VALUES (${userIdBigInt}, CURDATE(), 1, 0, NOW())
    ON DUPLICATE KEY UPDATE id = id
  `;

  if (affected === 0) {
    throw new AppError('今日已签到', ErrorCodes.PARAM_ERROR, 400);
  }

  // Compute streak: yesterday's streak + 1 (today)
  const yesterdayStreak = await computeStreak(userIdBigInt, false);
  const streakCount = yesterdayStreak + 1;

  // Calculate points
  const bonus = computeBonus(streakCount);
  const pointsAwarded = BASE_POINTS + bonus;

  // Atomic balance update
  await prisma.$executeRaw`
    UPDATE users SET totalPoints = totalPoints + ${pointsAwarded} WHERE id = ${userIdBigInt}
  `;

  // Get updated balance
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userIdBigInt },
    select: { totalPoints: true },
  });

  // Write points log
  await prisma.userPointsLog.create({
    data: {
      userId: userIdBigInt,
      points: pointsAwarded,
      balance: user.totalPoints,
      source: 'checkin',
      sourceId: dayjs(today).format('YYYY-MM-DD'),
      description: streakCount > 1
        ? `连续签到第${streakCount}天，获得${pointsAwarded}积分`
        : `签到获得${pointsAwarded}积分`,
    },
  });

  // Update checkin record with streak/points
  await prisma.$executeRaw`
    UPDATE user_checkins
    SET streakCount = ${streakCount}, pointsAwarded = ${pointsAwarded}
    WHERE userId = ${userIdBigInt} AND checkinDate = CURDATE()
  `;

  const { nextBonusAt, nextBonusPoints } = computeNextBonus(streakCount);

  return {
    checkinDate: dayjs(today).format('YYYY-MM-DD'),
    streakCount,
    pointsAwarded,
    totalPoints: user.totalPoints,
    nextBonusAt,
    nextBonusPoints,
  };
}

export async function getCheckinStatus(userId: string): Promise<CheckinStatus> {
  const userIdBigInt = BigInt(userId);
  const today = dayjs().startOf('day');

  // Check if already checked in today
  const todayCheckin = await prisma.userCheckin.findUnique({
    where: {
      userId_checkinDate: {
        userId: userIdBigInt,
        checkinDate: today.toDate(),
      },
    },
  });

  const checkedInToday = !!todayCheckin;

  // Compute current streak
  const currentStreak = await computeStreak(userIdBigInt, true);

  // Monthly checkins calendar
  const monthStart = today.startOf('month').toDate();
  const monthEnd = today.endOf('month').toDate();

  const monthlyRecords = await prisma.userCheckin.findMany({
    where: {
      userId: userIdBigInt,
      checkinDate: { gte: monthStart, lte: monthEnd },
    },
    select: { checkinDate: true },
    orderBy: { checkinDate: 'asc' },
  });

  const monthlyCheckins = monthlyRecords.map((r) => dayjs(r.checkinDate).format('YYYY-MM-DD'));

  // Get points balance
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userIdBigInt },
    select: { totalPoints: true },
  });

  const { nextBonusAt, nextBonusPoints } = computeNextBonus(currentStreak);

  return {
    checkedInToday,
    currentStreak,
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

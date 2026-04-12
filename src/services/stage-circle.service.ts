import prisma from '../config/database';
import { AppError, ErrorCodes } from '../middlewares/error.middleware';
import { calculatePregnancyWeekFromDueDate } from '../utils/pregnancy';

const DEFAULT_TARGET_MEMBERS = 8;
const MIN_MEMBERS = 5;
const MAX_MEMBERS = 10;

export interface StageCircleMemberPreview {
  id: string;
  nickname: string;
  avatar: string | null;
  currentWeek: number;
  weekLabel: string;
  role: 'host' | 'member';
  isCurrentUser: boolean;
}

export interface StageCircleSnapshot {
  circleKey: string;
  title: string;
  subtitle: string;
  stageLabel: string;
  currentWeek: number;
  weekRange: {
    start: number;
    end: number;
  };
  targetMembers: number;
  matchedMembers: number;
  isReady: boolean;
  hostUserId: string;
  discussionPrompts: string[];
  rules: string[];
  members: StageCircleMemberPreview[];
}

function getStageLabel(week: number): string {
  if (week <= 13) {
    return '孕早期';
  }

  if (week <= 27) {
    return '孕中期';
  }

  return '孕晚期';
}

function getWeekRange(week: number) {
  const start = Math.max(1, Math.floor((week - 1) / 4) * 4 + 1);
  const end = Math.min(40, start + 3);
  return { start, end };
}

function buildDiscussionPrompts(week: number) {
  const stageLabel = getStageLabel(week);
  return [
    `${stageLabel}最近最困扰你的一个变化是什么？`,
    `这周做过的产检、补剂或作息调整里，哪条对你最有帮助？`,
    `如果要给同周期妈妈一句提醒，你最想分享什么？`,
  ];
}

function buildRules() {
  return [
    '只聊同周期经验和日常支持，不替代医生诊断。',
    '紧急症状、出血、剧烈腹痛等情况优先线下就医。',
    '尊重隐私，不发布电话、微信号和外部引流信息。',
  ];
}

export async function getCurrentStageCircle(userId: string): Promise<StageCircleSnapshot> {
  const now = new Date();
  const currentUser = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: {
      id: true,
      username: true,
      nickname: true,
      avatar: true,
      pregnancyStatus: true,
      dueDate: true,
      createdAt: true,
    },
  });

  if (!currentUser || !currentUser.dueDate || currentUser.pregnancyStatus !== 2) {
    throw new AppError('当前用户未处于孕期，无法加入同周期互助圈', ErrorCodes.PARAM_ERROR, 400);
  }

  const currentWeek = calculatePregnancyWeekFromDueDate(currentUser.dueDate, now);
  if (!currentWeek) {
    throw new AppError('当前孕周无法计算，暂时无法匹配互助圈', ErrorCodes.PARAM_ERROR, 400);
  }

  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
      expireAt: { gt: now },
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  const subscribedUserIds = activeSubscriptions.map((item) => item.userId);
  const candidates = await prisma.user.findMany({
    where: {
      id: { in: subscribedUserIds },
      pregnancyStatus: 2,
      dueDate: { not: null },
      deletedAt: null,
      status: 1,
    },
    select: {
      id: true,
      username: true,
      nickname: true,
      avatar: true,
      dueDate: true,
      createdAt: true,
    },
  });

  const normalizedCandidates = candidates
    .map((item) => {
      const week = item.dueDate ? calculatePregnancyWeekFromDueDate(item.dueDate, now) : undefined;
      if (!week) {
        return null;
      }

      return {
        ...item,
        week,
        weekDiff: Math.abs(week - currentWeek),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a!.weekDiff !== b!.weekDiff) {
        return a!.weekDiff - b!.weekDiff;
      }

      if (a!.createdAt.getTime() !== b!.createdAt.getTime()) {
        return a!.createdAt.getTime() - b!.createdAt.getTime();
      }

      return Number(a!.id - b!.id);
    }) as Array<{
      id: bigint;
      username: string;
      nickname: string | null;
      avatar: string | null;
      dueDate: Date | null;
      createdAt: Date;
      week: number;
      weekDiff: number;
    }>;

  const primaryMembers = normalizedCandidates.filter((item) => item.weekDiff <= 1);
  const expandedMembers = normalizedCandidates.filter((item) => item.weekDiff <= 2);
  const candidatePool = primaryMembers.length >= MIN_MEMBERS ? primaryMembers : expandedMembers;
  const currentUserCandidate = normalizedCandidates.find((item) => item.id.toString() === userId);
  const selectedMembers = [
    ...(currentUserCandidate ? [currentUserCandidate] : []),
    ...candidatePool.filter((item) => item.id.toString() !== userId),
  ].slice(0, MAX_MEMBERS);

  const range = getWeekRange(currentWeek);
  const host = [...selectedMembers].sort((a, b) => {
    if (a.createdAt.getTime() !== b.createdAt.getTime()) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }

    return Number(a.id - b.id);
  })[0] || normalizedCandidates[0];

  const members = selectedMembers.map((member) => ({
    id: member.id.toString(),
    nickname: member.nickname || member.username,
    avatar: member.avatar,
    currentWeek: member.week,
    weekLabel: `孕 ${member.week} 周`,
    role: host && member.id === host.id ? 'host' as const : 'member' as const,
    isCurrentUser: member.id.toString() === userId,
  }));

  return {
    circleKey: `pregnant-${range.start}-${range.end}`,
    title: `${range.start}-${range.end} 周互助圈`,
    subtitle: '同周期妈妈 5-10 人小组，适合交流产检、作息、补剂和日常情绪支持。',
    stageLabel: getStageLabel(currentWeek),
    currentWeek,
    weekRange: range,
    targetMembers: DEFAULT_TARGET_MEMBERS,
    matchedMembers: members.length,
    isReady: members.length >= MIN_MEMBERS,
    hostUserId: host?.id.toString() || userId,
    discussionPrompts: buildDiscussionPrompts(currentWeek),
    rules: buildRules(),
    members,
  };
}

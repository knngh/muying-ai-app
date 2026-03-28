import prisma from '../config/database';

interface UserProfileContext {
  prompt?: string;
  retrievalHints: string[];
}

const PREGNANCY_STATUS_LABELS: Record<number, string> = {
  0: '未设置',
  1: '备孕中',
  2: '怀孕中',
  3: '产后育儿阶段',
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calculatePregnancyWeekFromDueDate(dueDate: Date, baseDate = new Date()): number | undefined {
  const due = startOfDay(dueDate);
  const today = startOfDay(baseDate);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  const week = 40 - Math.floor(diffDays / 7);

  if (week < 1 || week > 42) {
    return undefined;
  }

  return week;
}

function calculateBabyAgeMonths(babyBirthday: Date, baseDate = new Date()): number {
  const birth = startOfDay(babyBirthday);
  const today = startOfDay(baseDate);

  let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

function getPregnancyStageLabel(week?: number): string | undefined {
  if (!week) {
    return undefined;
  }

  if (week <= 13) {
    return '孕早期';
  }

  if (week <= 27) {
    return '孕中期';
  }

  return '孕晚期';
}

function getBabyStageLabel(months: number): string {
  if (months < 1) {
    return '新生儿阶段';
  }

  if (months < 12) {
    return '0-1岁婴儿阶段';
  }

  if (months < 36) {
    return '1-3岁幼儿阶段';
  }

  return '3岁以上儿童阶段';
}

export async function buildUserProfileContext(userId?: string): Promise<UserProfileContext> {
  if (!userId) {
    return { retrievalHints: [] };
  }

  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: {
      nickname: true,
      pregnancyStatus: true,
      dueDate: true,
      babyBirthday: true,
      babyGender: true,
    },
  });

  if (!user) {
    return { retrievalHints: [] };
  }

  const lines: string[] = [];
  const retrievalHints = new Set<string>();

  if (user.nickname) {
    lines.push(`- 用户昵称：${user.nickname}`);
  }

  if (user.pregnancyStatus !== undefined) {
    lines.push(`- 当前状态：${PREGNANCY_STATUS_LABELS[user.pregnancyStatus] || '未设置'}`);
  }

  if (user.pregnancyStatus === 2 && user.dueDate) {
    const week = calculatePregnancyWeekFromDueDate(user.dueDate);
    const stage = getPregnancyStageLabel(week);

    if (week) {
      lines.push(`- 当前孕周：约 ${week} 周`);
      retrievalHints.add(`${week}周`);
    }

    if (stage) {
      lines.push(`- 孕期阶段：${stage}`);
      retrievalHints.add(stage);
    }
  }

  if (user.pregnancyStatus === 3 && user.babyBirthday) {
    const months = calculateBabyAgeMonths(user.babyBirthday);
    const stage = getBabyStageLabel(months);

    lines.push(`- 宝宝月龄：约 ${months} 个月`);
    lines.push(`- 育儿阶段：${stage}`);
    retrievalHints.add(stage);
    if (months < 12) {
      retrievalHints.add('0-1岁');
    }
  }

  if (user.babyGender === 1) {
    lines.push('- 宝宝性别：男宝宝');
  } else if (user.babyGender === 2) {
    lines.push('- 宝宝性别：女宝宝');
  }

  if (lines.length === 0) {
    return { retrievalHints: Array.from(retrievalHints) };
  }

  return {
    prompt: `用户历史档案（仅供参考，可能不是最新状态）：\n${lines.join('\n')}`,
    retrievalHints: Array.from(retrievalHints),
  };
}

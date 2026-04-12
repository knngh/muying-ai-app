import dayjs from 'dayjs';
import { calculatePregnancyWeekFromDueDate, normalizePregnancyStatus } from './pregnancy';

type MilestoneStatus = 'done' | 'active' | 'upcoming';

interface PregnancyProfilePhase {
  label: string;
  title: string;
  subtitle: string;
  focusTitle: string;
  focusText: string;
}

interface PregnancyProfileSnapshotInput {
  completedTodoCount: number;
  customTodoCount: number;
  weeklyDiaryDate?: Date | null;
  weeklyDiaryContent?: string | null;
}

interface PregnancyProfileUserLike {
  pregnancyStatus?: unknown;
  dueDate?: Date | null;
  babyBirthday?: Date | null;
}

export interface PregnancyProfileMilestonePayload {
  title: string;
  startWeek: number;
  endWeek: number;
  anchorWeek: number;
  description: string;
  status: MilestoneStatus;
  statusText: string;
  windowText: string;
  anchorDateText: string;
}

export interface PregnancyProfilePayload {
  isPregnancyReady: boolean;
  currentWeek: number | null;
  dueDate: string | null;
  daysUntilDue: number | null;
  progressPercent: number;
  heroTags: string[];
  phase: PregnancyProfilePhase;
  snapshot: {
    completedTodoCount: number;
    customTodoCount: number;
    hasWeeklyDiary: boolean;
    weeklyDiaryDate: string | null;
    weeklyDiaryPreview: string | null;
  };
  milestones: PregnancyProfileMilestonePayload[];
  nextMilestoneText: string;
}

type MilestoneConfig = {
  title: string;
  startWeek: number;
  endWeek: number;
  anchorWeek: number;
  description: string;
};

const EMPTY_PHASE: PregnancyProfilePhase = {
  label: '孕期未完善',
  title: '先完善孕期资料',
  subtitle: '补充预产期后，这里会自动生成当前孕周、关键节点和阶段重点。',
  focusTitle: '当前还不能生成孕期档案',
  focusText: '先去完善预产期和孕期状态，档案页会再自动同步当前阶段。',
};

const MILESTONES: MilestoneConfig[] = [
  {
    title: '建档与首轮检查',
    startWeek: 6,
    endWeek: 8,
    anchorWeek: 7,
    description: '优先确认建档资料、基础检查和补充叶酸节奏，让后续产检更顺。',
  },
  {
    title: 'NT 检查',
    startWeek: 11,
    endWeek: 13,
    anchorWeek: 12,
    description: '尽量提前预约，把检查时间和需要携带的资料放进日历。',
  },
  {
    title: '唐筛 / 无创窗口',
    startWeek: 15,
    endWeek: 20,
    anchorWeek: 17,
    description: '提前和医生确认适合的筛查方案，避免错过窗口期。',
  },
  {
    title: '大排畸检查',
    startWeek: 20,
    endWeek: 24,
    anchorWeek: 22,
    description: '这是孕中期的重要节点，适合提前预留完整时间安排。',
  },
  {
    title: '糖耐与常规产检',
    startWeek: 24,
    endWeek: 28,
    anchorWeek: 26,
    description: '饮食、作息和控糖记录可以在这段时间集中整理起来。',
  },
  {
    title: '胎位与胎心监护准备',
    startWeek: 32,
    endWeek: 36,
    anchorWeek: 34,
    description: '孕晚期开始把胎动、睡眠、体力和住院准备持续记录下来。',
  },
  {
    title: '待产准备',
    startWeek: 36,
    endWeek: 40,
    anchorWeek: 37,
    description: '把待产包、住院材料、家人分工和应急联系人全部收拢确认。',
  },
];

function buildPhaseSummary(week: number): PregnancyProfilePhase {
  if (week <= 13) {
    return {
      label: '孕早期',
      title: `孕 ${week} 周档案`,
      subtitle: '把建档、早孕反应和首轮检查收在同一个页面里，方便集中回看。',
      focusTitle: '现在适合先把基础节奏稳下来',
      focusText: '优先关注建档、叶酸补充、作息和早孕反应，把每次检查结果和不适感受记清楚。',
    };
  }

  if (week <= 27) {
    return {
      label: '孕中期',
      title: `孕 ${week} 周档案`,
      subtitle: '这是相对稳定的阶段，更适合沉淀产检节点、胎动变化和日常状态。',
      focusTitle: '现在适合把产检与日常观察连起来',
      focusText: '重点跟进大排畸、糖耐、体重变化、睡眠和胎动，把零散提醒变成连续记录。',
    };
  }

  return {
    label: '孕晚期',
    title: `孕 ${week} 周档案`,
    subtitle: '临近分娩，档案页更适合集中收拢待产准备、家人分工和住院物品。',
    focusTitle: '现在适合提前做待产交接',
    focusText: '把待产包、住院证件、产检安排和家人协作固定下来，避免临近预产期再补漏洞。',
  };
}

function buildHeroTags(phaseLabel: string, currentWeek: number, daysUntilDue: number | null): string[] {
  const tags = [phaseLabel, `第 ${currentWeek} 周`];
  if (daysUntilDue !== null) {
    tags.push(`距预产期 ${daysUntilDue} 天`);
  }
  return tags;
}

function buildMilestones(dueDate: Date, currentWeek: number): PregnancyProfileMilestonePayload[] {
  return MILESTONES.map((item) => {
    let status: MilestoneStatus = 'upcoming';
    let statusText = '待安排';

    if (currentWeek > item.endWeek) {
      status = 'done';
      statusText = '已过窗口';
    } else if (currentWeek >= item.startWeek && currentWeek <= item.endWeek) {
      status = 'active';
      statusText = '当前阶段';
    }

    const anchorDate = dayjs(dueDate).subtract((40 - item.anchorWeek) * 7, 'day').format('MM-DD');

    return {
      ...item,
      status,
      statusText,
      windowText: `${item.startWeek}-${item.endWeek} 周`,
      anchorDateText: `建议关注 ${anchorDate}`,
    };
  });
}

function buildNextMilestoneText(milestones: PregnancyProfileMilestonePayload[]): string {
  const activeOrNext = milestones.find((item) => item.status !== 'done');
  if (!activeOrNext) {
    return '已经进入待产准备区间，优先把住院证件、待产包和家人分工再检查一遍。';
  }

  return `${activeOrNext.title}：${activeOrNext.windowText}，${activeOrNext.anchorDateText}`;
}

function formatDiaryPreview(content?: string | null): string | null {
  const normalized = content?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > 78 ? `${normalized.slice(0, 78)}...` : normalized;
}

export function buildPregnancyProfile(
  user: PregnancyProfileUserLike,
  snapshot: PregnancyProfileSnapshotInput,
): PregnancyProfilePayload {
  const dueDate = user.dueDate ?? null;
  const currentWeek = dueDate ? calculatePregnancyWeekFromDueDate(dueDate) ?? null : null;

  if (!dueDate || currentWeek === null) {
    return {
      isPregnancyReady: false,
      currentWeek: null,
      dueDate: null,
      daysUntilDue: null,
      progressPercent: 0,
      heroTags: [],
      phase: EMPTY_PHASE,
      snapshot: {
        completedTodoCount: 0,
        customTodoCount: 0,
        hasWeeklyDiary: false,
        weeklyDiaryDate: null,
        weeklyDiaryPreview: null,
      },
      milestones: [],
      nextMilestoneText: '补充预产期后，这里会自动生成关键孕期节点。',
    };
  }

  const daysUntilDue = Math.max(dayjs(dueDate).startOf('day').diff(dayjs().startOf('day'), 'day'), 0);
  const phase = buildPhaseSummary(currentWeek);
  const milestones = buildMilestones(dueDate, currentWeek);

  return {
    isPregnancyReady: true,
    currentWeek,
    dueDate: dayjs(dueDate).format('YYYY-MM-DD'),
    daysUntilDue,
    progressPercent: Math.min(100, Math.max(0, Math.round((currentWeek / 40) * 100))),
    heroTags: buildHeroTags(phase.label, currentWeek, daysUntilDue),
    phase,
    snapshot: {
      completedTodoCount: snapshot.completedTodoCount,
      customTodoCount: snapshot.customTodoCount,
      hasWeeklyDiary: Boolean(snapshot.weeklyDiaryContent?.trim()),
      weeklyDiaryDate: snapshot.weeklyDiaryDate ? dayjs(snapshot.weeklyDiaryDate).format('YYYY-MM-DD') : null,
      weeklyDiaryPreview: formatDiaryPreview(snapshot.weeklyDiaryContent),
    },
    milestones,
    nextMilestoneText: buildNextMilestoneText(milestones),
  };
}

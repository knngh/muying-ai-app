import dayjs from 'dayjs';

export type TimelineStage = 'pregnancy' | 'postpartum';

export interface TimelinePeriod {
  timelineKey: string;
  stage: TimelineStage;
  week: number;
  storageWeek: number;
  title: string;
  shortTitle: string;
}

export interface TimelineAnchorResolution {
  babyBirthday: Date | null;
  source: 'user' | 'growth_profile' | null;
}

export const PREGNANCY_WEEK_MIN = 1;
export const PREGNANCY_WEEK_MAX = 40;
export const POSTPARTUM_WEEK_MIN = 1;
export const POSTPARTUM_WEEK_MAX = 156;
export const POSTPARTUM_STORAGE_WEEK_OFFSET = 40;
export const POSTPARTUM_STORAGE_WEEK_MAX = POSTPARTUM_STORAGE_WEEK_OFFSET + POSTPARTUM_WEEK_MAX;

const TIMELINE_KEY_PATTERN = /^(pregnancy|postpartum):w(\d{1,3})$/i;

function padWeek(week: number): string {
  return String(week).padStart(2, '0');
}

export function buildTimelineKey(stage: TimelineStage, week: number): string {
  return `${stage}:w${padWeek(week)}`;
}

export function getPostpartumStorageWeek(postpartumWeek: number): number {
  if (!Number.isInteger(postpartumWeek) || postpartumWeek < POSTPARTUM_WEEK_MIN || postpartumWeek > POSTPARTUM_WEEK_MAX) {
    throw new Error('产后周数无效');
  }

  return POSTPARTUM_STORAGE_WEEK_OFFSET + postpartumWeek;
}

export function getPostpartumWeekFromStorageWeek(storageWeek: number): number | null {
  if (!Number.isInteger(storageWeek) || storageWeek <= POSTPARTUM_STORAGE_WEEK_OFFSET || storageWeek > POSTPARTUM_STORAGE_WEEK_MAX) {
    return null;
  }

  return storageWeek - POSTPARTUM_STORAGE_WEEK_OFFSET;
}

export function toTimelinePeriodFromStorageWeek(storageWeek: number): TimelinePeriod {
  if (!Number.isInteger(storageWeek) || storageWeek < PREGNANCY_WEEK_MIN || storageWeek > POSTPARTUM_STORAGE_WEEK_MAX) {
    throw new Error('时间线周数无效');
  }

  const postpartumWeek = getPostpartumWeekFromStorageWeek(storageWeek);
  if (postpartumWeek !== null) {
    return {
      timelineKey: buildTimelineKey('postpartum', postpartumWeek),
      stage: 'postpartum',
      week: postpartumWeek,
      storageWeek,
      title: `出生后第 ${postpartumWeek} 周`,
      shortTitle: `第 ${postpartumWeek} 周`,
    };
  }

  return {
    timelineKey: buildTimelineKey('pregnancy', storageWeek),
    stage: 'pregnancy',
    week: storageWeek,
    storageWeek,
    title: `孕第 ${storageWeek} 周`,
    shortTitle: `孕 ${storageWeek} 周`,
  };
}

export function parseTimelineKey(value: string): TimelinePeriod | null {
  const match = TIMELINE_KEY_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const stage = match[1].toLowerCase() as TimelineStage;
  const week = Number(match[2]);
  if (!Number.isInteger(week)) {
    return null;
  }

  if (stage === 'pregnancy') {
    if (week < PREGNANCY_WEEK_MIN || week > PREGNANCY_WEEK_MAX) {
      return null;
    }

    return toTimelinePeriodFromStorageWeek(week);
  }

  if (week < POSTPARTUM_WEEK_MIN || week > POSTPARTUM_WEEK_MAX) {
    return null;
  }

  return toTimelinePeriodFromStorageWeek(getPostpartumStorageWeek(week));
}

export function parseTimelinePeriodInput(input: { week?: unknown; timelineKey?: unknown }): TimelinePeriod | null {
  if (typeof input.timelineKey === 'string' && input.timelineKey.trim()) {
    return parseTimelineKey(input.timelineKey.trim());
  }

  if (input.week === undefined || input.week === null || input.week === '') {
    return null;
  }

  const storageWeek = Number(input.week);
  if (!Number.isInteger(storageWeek)) {
    return null;
  }

  try {
    return toTimelinePeriodFromStorageWeek(storageWeek);
  } catch {
    return null;
  }
}

export function calculatePostpartumWeek(babyBirthday: Date, now: Date = new Date()): number {
  const birth = dayjs(babyBirthday).startOf('day');
  const current = dayjs(now).startOf('day');
  const ageDays = Math.max(0, current.diff(birth, 'day'));
  return Math.min(POSTPARTUM_WEEK_MAX, Math.floor(ageDays / 7) + 1);
}

export function resolveTimelineBabyBirthday(input: {
  userBabyBirthday?: Date | null;
  growthProfileBirthday?: Date | null;
}): TimelineAnchorResolution {
  if (input.userBabyBirthday) {
    return { babyBirthday: input.userBabyBirthday, source: 'user' };
  }

  if (input.growthProfileBirthday) {
    return { babyBirthday: input.growthProfileBirthday, source: 'growth_profile' };
  }

  return { babyBirthday: null, source: null };
}

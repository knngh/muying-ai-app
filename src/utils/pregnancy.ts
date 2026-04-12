const DAY_IN_MS = 24 * 60 * 60 * 1000;
const FULL_TERM_WEEKS = 40;

const pregnancyStatusMap: Record<string, number> = {
  preparing: 1,
  pregnant: 2,
  postpartum: 3,
};

const genderMap: Record<string, number> = {
  unknown: 0,
  male: 1,
  female: 2,
};

const caregiverRoleMap: Record<string, number> = {
  mother: 1,
  mom: 1,
  mama: 1,
  father: 2,
  dad: 2,
  papa: 2,
  grandparent: 3,
  grandma: 3,
  grandpa: 3,
  elder: 3,
  other: 4,
};

const childBirthModeMap: Record<string, number> = {
  vaginal: 1,
  natural: 1,
  csection: 2,
  'c-section': 2,
  cesarean: 2,
};

const feedingModeMap: Record<string, number> = {
  breastfeeding: 1,
  breast: 1,
  formula: 2,
  mixed: 3,
  solids: 4,
};

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfDay(date: Date): Date {
  return normalizeDate(date);
}

export function normalizePregnancyStatus(value: unknown): number | undefined {
  const numericValue = normalizeNumber(value);
  if (numericValue !== undefined && numericValue >= 0 && numericValue <= 3) {
    return numericValue;
  }

  if (typeof value === 'string') {
    return pregnancyStatusMap[value.trim().toLowerCase()];
  }

  return undefined;
}

export type LifecycleStage = 'preparing' | 'pregnant' | 'postpartum';

export function resolveLifecycleStage(
  pregnancyStatus?: unknown,
  dueDate?: Date | null,
  babyBirthday?: Date | null,
): LifecycleStage {
  if (dueDate) {
    return 'pregnant';
  }

  if (babyBirthday) {
    return 'postpartum';
  }

  const normalizedStatus = normalizePregnancyStatus(pregnancyStatus);
  if (normalizedStatus === 2) {
    return 'pregnant';
  }

  if (normalizedStatus === 3) {
    return 'postpartum';
  }

  return 'preparing';
}

export function normalizeGender(value: unknown): number | undefined {
  const numericValue = normalizeNumber(value);
  if (numericValue !== undefined && numericValue >= 0 && numericValue <= 2) {
    return numericValue;
  }

  if (typeof value === 'string') {
    return genderMap[value.trim().toLowerCase()];
  }

  return undefined;
}

export function normalizeCaregiverRole(value: unknown): number | undefined {
  const numericValue = normalizeNumber(value);
  if (numericValue !== undefined && numericValue >= 0 && numericValue <= 4) {
    return numericValue;
  }

  if (typeof value === 'string') {
    return caregiverRoleMap[value.trim().toLowerCase()];
  }

  return undefined;
}

export function normalizeChildBirthMode(value: unknown): number | undefined {
  const numericValue = normalizeNumber(value);
  if (numericValue !== undefined && numericValue >= 0 && numericValue <= 2) {
    return numericValue;
  }

  if (typeof value === 'string') {
    return childBirthModeMap[value.trim().toLowerCase()];
  }

  return undefined;
}

export function normalizeFeedingMode(value: unknown): number | undefined {
  const numericValue = normalizeNumber(value);
  if (numericValue !== undefined && numericValue >= 0 && numericValue <= 4) {
    return numericValue;
  }

  if (typeof value === 'string') {
    return feedingModeMap[value.trim().toLowerCase()];
  }

  return undefined;
}

export function calculateDueDateFromPregnancyWeek(value: unknown, baseDate = new Date()): Date | undefined {
  const week = normalizeNumber(value);

  if (week === undefined || week < 1 || week > FULL_TERM_WEEKS) {
    return undefined;
  }

  const today = normalizeDate(baseDate);
  const dueDate = new Date(today.getTime() + (FULL_TERM_WEEKS - week) * 7 * DAY_IN_MS);
  return normalizeDate(dueDate);
}

export function calculatePregnancyWeekFromDueDate(dueDate: Date, baseDate = new Date()): number | undefined {
  const due = startOfDay(dueDate);
  const today = startOfDay(baseDate);
  const diffDays = Math.round((due.getTime() - today.getTime()) / DAY_IN_MS);
  const week = FULL_TERM_WEEKS - Math.floor(diffDays / 7);

  if (week < 1 || week > 42) {
    return undefined;
  }

  return week;
}

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

export function calculateDueDateFromPregnancyWeek(value: unknown, baseDate = new Date()): Date | undefined {
  const week = normalizeNumber(value);

  if (week === undefined || week < 1 || week > FULL_TERM_WEEKS) {
    return undefined;
  }

  const today = normalizeDate(baseDate);
  const dueDate = new Date(today.getTime() + (FULL_TERM_WEEKS - week) * 7 * DAY_IN_MS);
  return normalizeDate(dueDate);
}

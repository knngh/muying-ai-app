import { formatDateOnly } from './pregnancy';

type UserDateFields = {
  birthday?: Date | string | null;
  dueDate?: Date | string | null;
  babyBirthday?: Date | string | null;
};

const DATE_FIELDS = ['birthday', 'dueDate', 'babyBirthday'] as const;

export function serializeUserDateFields<T extends UserDateFields>(user: T): T {
  const output: Record<string, unknown> = { ...user };

  for (const field of DATE_FIELDS) {
    if (!(field in output)) continue;

    const value = output[field];
    output[field] = value instanceof Date ? formatDateOnly(value) : value ?? null;
  }

  return output as T;
}

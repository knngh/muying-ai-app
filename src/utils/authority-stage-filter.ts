import { AUTHORITY_STAGE_VALUES, type AuthorityStage } from './authority-stage';

const AUTHORITY_STAGE_SET = new Set<string>(AUTHORITY_STAGE_VALUES);

function toStageTokens(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap((item) => toStageTokens(item));
  }

  if (typeof input !== 'string') {
    return [];
  }

  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeAuthorityStageFilters(input: unknown): AuthorityStage[] {
  const seen = new Set<AuthorityStage>();
  const stages: AuthorityStage[] = [];

  for (const token of toStageTokens(input)) {
    if (!AUTHORITY_STAGE_SET.has(token)) {
      continue;
    }

    const stage = token as AuthorityStage;
    if (seen.has(stage)) {
      continue;
    }

    seen.add(stage);
    stages.push(stage);
  }

  return stages;
}

export function matchesAuthorityStageFilters(articleStages: string[], filters: unknown): boolean {
  const normalizedFilters = normalizeAuthorityStageFilters(filters);
  if (normalizedFilters.length === 0) {
    return true;
  }

  return articleStages.some((stage) => normalizedFilters.includes(stage as AuthorityStage));
}

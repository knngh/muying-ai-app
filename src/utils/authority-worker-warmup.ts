import type { WarmAuthorityTranslationsOptions } from '../services/authority-translation.service';

export type AuthorityWorkerTranslationWarmupPhase = 'startup' | 'after_sync' | 'interval';

function parseNonNegativeInt(value: string | undefined, fallback?: number): number | undefined {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

export function resolveAuthorityWorkerTranslationWarmupOptions(
  phase: AuthorityWorkerTranslationWarmupPhase,
  env: NodeJS.ProcessEnv = process.env,
): WarmAuthorityTranslationsOptions {
  if (phase !== 'startup') {
    return {};
  }

  const options: WarmAuthorityTranslationsOptions = {
    limit: parseNonNegativeInt(env.AUTHORITY_TRANSLATION_STARTUP_LIMIT, 0),
  };
  const delayMs = parseNonNegativeInt(env.AUTHORITY_TRANSLATION_STARTUP_DELAY_MS);
  if (delayMs !== undefined) {
    options.delayMs = delayMs;
  }

  return options;
}

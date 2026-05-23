import type { AITaskModelRole } from '../services/ai-gateway.service';

const SUPPORTED_TRANSLATION_TASK_ROLES = new Set<AITaskModelRole>([
  'deepseek_translate',
  'glm_classify',
  'kimi_reason',
  'minimax_render',
]);
const PAID_TRANSLATION_FALLBACK_ROLES = new Set<AITaskModelRole>([
  'kimi_reason',
  'minimax_render',
]);
const DEFAULT_TRANSLATION_TASK_ROLES: AITaskModelRole[] = ['deepseek_translate', 'glm_classify'];

function envFlag(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(value || '');
}

export function isAuthorityTranslationPaidFallbackAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlag(env.AUTHORITY_TRANSLATION_ALLOW_PAID_FALLBACK);
}

export function resolveAuthorityTranslationTaskRoles(
  env: NodeJS.ProcessEnv = process.env,
): AITaskModelRole[] {
  const explicitTaskRoles = (env.AUTHORITY_TRANSLATION_TASK_ROLES || '').trim();
  const configured = (explicitTaskRoles || DEFAULT_TRANSLATION_TASK_ROLES.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const roles = configured.filter((item): item is AITaskModelRole => (
    SUPPORTED_TRANSLATION_TASK_ROLES.has(item as AITaskModelRole)
  ));
  const uniqueRoles = Array.from(new Set<AITaskModelRole>(
    roles.length > 0 ? roles : DEFAULT_TRANSLATION_TASK_ROLES,
  ));

  if (isAuthorityTranslationPaidFallbackAllowed(env)) {
    return uniqueRoles;
  }

  if (explicitTaskRoles) {
    return uniqueRoles;
  }

  return uniqueRoles.filter((role) => !PAID_TRANSLATION_FALLBACK_ROLES.has(role));
}

export function shouldUsePrimaryOnlyForAuthorityTranslation(
  taskRole: AITaskModelRole,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return DEFAULT_TRANSLATION_TASK_ROLES.includes(taskRole)
    && !isAuthorityTranslationPaidFallbackAllowed(env);
}

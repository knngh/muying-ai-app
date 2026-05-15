import type { AITaskModelRole } from '../services/ai-gateway.service';

const SUPPORTED_TRANSLATION_TASK_ROLES = new Set<AITaskModelRole>([
  'glm_classify',
  'kimi_reason',
  'minimax_render',
]);
const PAID_TRANSLATION_FALLBACK_ROLES = new Set<AITaskModelRole>([
  'kimi_reason',
  'minimax_render',
]);
const FREE_TRANSLATION_TASK_ROLE: AITaskModelRole = 'glm_classify';

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
  const configured = (env.AUTHORITY_TRANSLATION_TASK_ROLES || FREE_TRANSLATION_TASK_ROLE)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const roles = configured.filter((item): item is AITaskModelRole => (
    SUPPORTED_TRANSLATION_TASK_ROLES.has(item as AITaskModelRole)
  ));
  const uniqueRoles = Array.from(new Set<AITaskModelRole>(
    roles.length > 0 ? roles : [FREE_TRANSLATION_TASK_ROLE],
  ));
  const freeFirstRoles = uniqueRoles.includes(FREE_TRANSLATION_TASK_ROLE)
    ? uniqueRoles
    : [FREE_TRANSLATION_TASK_ROLE, ...uniqueRoles];

  if (isAuthorityTranslationPaidFallbackAllowed(env)) {
    return freeFirstRoles;
  }

  return freeFirstRoles.filter((role) => !PAID_TRANSLATION_FALLBACK_ROLES.has(role));
}

export function shouldUsePrimaryOnlyForAuthorityTranslation(
  taskRole: AITaskModelRole,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return taskRole === FREE_TRANSLATION_TASK_ROLE
    && !isAuthorityTranslationPaidFallbackAllowed(env);
}

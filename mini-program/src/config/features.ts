const readBooleanEnv = (value: string | boolean | undefined, fallback = false) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

export const features = {
  aiQaAssistant: readBooleanEnv(import.meta.env.VITE_ENABLE_AI_QA_ASSISTANT, false),
} as const

export function isFeatureEnabled(feature: keyof typeof features) {
  return features[feature]
}

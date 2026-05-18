export interface AcquisitionContext {
  channel: string | null
  campaign: string | null
  scene: string | null
  entrySource: string | null
}

export interface AcquisitionLaunchProperties {
  entryPath?: string | null
  entrySource?: string | null
}

const ACQUISITION_CONTEXT_STORAGE_KEY = 'acquisitionContext'
const MAX_VALUE_LENGTH = 80

function sanitizeValue(input: unknown, maxLength = MAX_VALUE_LENGTH): string | null {
  if (typeof input !== 'string' && typeof input !== 'number') {
    return null
  }

  const normalized = String(input)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized ? normalized.slice(0, maxLength) : null
}

function safeDecodeURIComponent(input: string): string {
  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

function parsePackedQuery(input: unknown): Record<string, string> {
  const raw = sanitizeValue(input, 240)
  if (!raw || !/[=&]/.test(raw)) {
    return {}
  }

  const result: Record<string, string> = {}
  raw.split('&').forEach((segment) => {
    const index = segment.indexOf('=')
    if (index <= 0) {
      return
    }

    const key = safeDecodeURIComponent(segment.slice(0, index).replace(/\+/g, ' '))
    const value = safeDecodeURIComponent(segment.slice(index + 1).replace(/\+/g, ' '))
    if (!key || !value) {
      return
    }

    result[key] = value
  })

  return result
}

function readStoredContext(): AcquisitionContext {
  const stored = uni.getStorageSync(ACQUISITION_CONTEXT_STORAGE_KEY) as Partial<AcquisitionContext> | null
  return {
    channel: sanitizeValue(stored?.channel),
    campaign: sanitizeValue(stored?.campaign),
    scene: sanitizeValue(stored?.scene),
    entrySource: sanitizeValue(stored?.entrySource),
  }
}

function persistContext(context: AcquisitionContext) {
  uni.setStorageSync(ACQUISITION_CONTEXT_STORAGE_KEY, context)
}

function hasContextValue(context: AcquisitionContext): boolean {
  return Boolean(context.channel || context.campaign || context.scene || context.entrySource)
}

function pickFirstValue(...values: unknown[]): string | null {
  for (const value of values) {
    const sanitized = sanitizeValue(value)
    if (sanitized) {
      return sanitized
    }
  }
  return null
}

function normalizeInput(input: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!input || typeof input !== 'object') {
    return {}
  }

  return input
}

function buildAcquisitionContext(input: Record<string, unknown> | null | undefined): AcquisitionContext {
  const raw = normalizeInput(input)
  const packedScene = parsePackedQuery(raw.scene)
  const packedEntrySource = parsePackedQuery(raw.entrySource)
  const sceneValue = packedScene.scene || sanitizeValue(raw.scene)

  return {
    channel: pickFirstValue(
      raw.acquisitionChannel,
      packedScene.acquisitionChannel,
      packedScene.channel,
      raw.channel,
      raw.trafficChannel,
      raw.utmChannel,
      raw.utmSource,
      raw.utm_source,
      raw.sourceChannel,
    ),
    campaign: pickFirstValue(
      raw.acquisitionCampaign,
      packedScene.acquisitionCampaign,
      packedScene.campaign,
      raw.campaign,
      raw.campaignId,
      raw.utmCampaign,
      raw.utm_campaign,
      raw.activity,
      raw.promotion,
    ),
    scene: pickFirstValue(
      raw.acquisitionScene,
      packedScene.acquisitionScene,
      sceneValue,
      raw.entryScene,
      raw.fromScene,
      raw.triggerScene,
      raw.downloadScene,
      raw.utm_scene,
    ),
    entrySource: pickFirstValue(
      raw.acquisitionEntrySource,
      packedScene.acquisitionEntrySource,
      packedEntrySource.acquisitionEntrySource,
      packedEntrySource.entrySource,
      raw.entrySource,
      raw.entry_source,
    ),
  }
}

export function readAcquisitionContext(): AcquisitionContext {
  return readStoredContext()
}

export function hasAcquisitionContext(context = readAcquisitionContext()): boolean {
  return hasContextValue(context)
}

export function recordAcquisitionContext(input: Record<string, unknown> | null | undefined): AcquisitionContext | null {
  const next = buildAcquisitionContext(input)
  if (!hasContextValue(next)) {
    return null
  }

  const current = readStoredContext()
  const merged: AcquisitionContext = {
    channel: next.channel || current.channel,
    campaign: next.campaign || current.campaign,
    scene: next.scene || current.scene,
    entrySource: next.entrySource || current.entrySource,
  }

  if (
    merged.channel !== current.channel
    || merged.campaign !== current.campaign
    || merged.scene !== current.scene
    || merged.entrySource !== current.entrySource
  ) {
    persistContext(merged)
  }

  return merged
}

export function clearAcquisitionContext(): void {
  uni.removeStorageSync(ACQUISITION_CONTEXT_STORAGE_KEY)
}

export function buildAcquisitionQuery(
  extra?: Record<string, string | number | boolean | null | undefined>,
): string {
  const context = readStoredContext()
  const params: Record<string, string> = {}

  const pushParam = (key: string, value: unknown) => {
    const sanitized = sanitizeValue(value)
    if (sanitized) {
      params[key] = sanitized
    }
  }

  pushParam('channel', context.channel)
  pushParam('campaign', context.campaign)
  pushParam('scene', context.scene)
  pushParam('entrySource', context.entrySource)

  if (extra) {
    Object.entries(extra).forEach(([key, value]) => {
      pushParam(key, value)
    })
  }

  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

export function buildAcquisitionPath(
  path: string,
  extra?: Record<string, string | number | boolean | null | undefined>,
): string {
  const query = buildAcquisitionQuery(extra)
  if (!query) {
    return path
  }

  return `${path}${path.includes('?') ? '&' : '?'}${query}`
}

export function getAcquisitionAnalyticsProperties(
  input?: Record<string, unknown> | null,
): Record<string, unknown> {
  const context = readStoredContext()
  const properties: Record<string, unknown> = {}

  if (context.channel) properties.acquisitionChannel = context.channel
  if (context.campaign) properties.acquisitionCampaign = context.campaign
  if (context.scene) properties.acquisitionScene = context.scene
  if (context.entrySource) properties.acquisitionEntrySource = context.entrySource

  if (input && typeof input === 'object') {
    Object.assign(properties, input)
  }

  return properties
}

export function inferAcquisitionEntrySource(path?: string | null): string | null {
  const normalized = sanitizeValue(path, 120)
  if (!normalized) {
    return null
  }

  if (normalized.includes('/pages/knowledge-detail/')) return 'knowledge_detail'
  if (normalized.includes('/pages/knowledge/')) return 'knowledge'
  if (normalized.includes('/pages/calendar/')) return 'calendar'
  if (normalized.includes('/pages/chat/')) return 'chat'
  if (normalized.includes('/pages/home/')) return 'home'
  if (normalized.includes('/pages/profile/')) return 'profile'
  return null
}

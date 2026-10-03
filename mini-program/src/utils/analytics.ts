import { getAcquisitionAnalyticsProperties } from './acquisition'
import { NAME_LIBRARY_CLOUD_ENABLED, TOOL_CLOUD_ENABLED } from '@/config/features'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://beihu.me/api/v1'
const CLIENT_ID_KEY = 'analytics_client_id'
const SESSION_ID = createId()

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function getClientId(): string {
  const cached = uni.getStorageSync(CLIENT_ID_KEY)
  if (cached) return String(cached)

  const nextId = createId()
  uni.setStorageSync(CLIENT_ID_KEY, nextId)
  return nextId
}

export function trackMiniEvent(
  eventName:
    | 'mini_program_app_download_click'
    | 'app_knowledge_detail_open'
    | 'app_knowledge_detail_share'
    | 'app_name_library_open'
    | 'app_name_library_filter'
    | 'app_name_library_favorite'
    | 'app_name_library_copy'
    | 'app_name_library_share'
    | 'app_tool_open'
    | 'app_tool_record_save'
    | 'app_tool_record_delete',
  input: {
    page: string
    properties?: Record<string, unknown>
  },
): void {
  if (eventName.startsWith('app_tool_') && !TOOL_CLOUD_ENABLED) return
  if (eventName.startsWith('app_name_library_') && !NAME_LIBRARY_CLOUD_ENABLED) return
  try {
    const token = uni.getStorageSync('token')
    const header: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (token) {
      header.Authorization = `Bearer ${token}`
    }

    uni.request({
      url: `${BASE_URL}/analytics/events`,
      method: 'POST',
      header,
      data: {
        eventName,
        source: 'mini_program',
        page: input.page,
        clientId: getClientId(),
        sessionId: SESSION_ID,
        properties: getAcquisitionAnalyticsProperties(input.properties),
      },
    })
  } catch {
    // 埋点失败不影响主流程
  }
}

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
    | 'app_knowledge_detail_ask_ai_click'
    | 'app_knowledge_detail_ai_hit_open'
    | 'app_knowledge_recent_ai_hit_click'
    | 'app_knowledge_recent_ai_topic_click'
    | 'app_knowledge_recent_ai_source_click'
    | 'app_knowledge_recent_ai_ask_click',
  input: {
    page: string
    properties?: Record<string, unknown>
  },
): void {
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
        properties: input.properties,
      },
    })
  } catch {
    // 埋点失败不影响主流程
  }
}

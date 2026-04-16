import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/index';

type AppAnalyticsEventName =
  | 'app_home_v1_exposure'
  | 'app_home_return_plan_exposure'
  | 'app_home_return_plan_click'
  | 'app_home_membership_nudge_exposure'
  | 'app_home_membership_nudge_click'
  | 'app_home_growth_archive_click'
  | 'app_membership_context_exposure'
  | 'app_membership_context_click'
  | 'app_membership_exposure'
  | 'app_weekly_report_open'
  | 'app_growth_archive_share'
  | 'app_growth_archive_context_exposure'
  | 'app_growth_archive_context_click'
  | 'app_home_primary_task_click'
  | 'app_home_checkin_click'
  | 'app_home_weekly_report_click'
  | 'app_home_momentum_click'
  | 'app_weekly_report_add_calendar_click'
  | 'app_weekly_report_ask_ai_click'
  | 'app_home_suggested_question_click'
  | 'app_home_post_checkin_next_click'
  | 'app_chat_prefill_entry'
  | 'app_chat_message_send'
  | 'app_chat_response_receive';

const CLIENT_ID_KEY = 'analytics_client_id';
const SESSION_ID = createId();

let clientIdPromise: Promise<string> | null = null;

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getClientId() {
  const cached = await AsyncStorage.getItem(CLIENT_ID_KEY);
  if (cached) return cached;

  const nextId = createId();
  await AsyncStorage.setItem(CLIENT_ID_KEY, nextId);
  return nextId;
}

async function ensureClientId() {
  if (!clientIdPromise) {
    clientIdPromise = getClientId().finally(() => {
      clientIdPromise = null;
    });
  }

  return clientIdPromise;
}

export async function trackAppEvent(
  eventName: AppAnalyticsEventName,
  input: {
    page: string;
    properties?: Record<string, unknown>;
  },
) {
  try {
    const clientId = await ensureClientId();
    await api.post('/analytics/events', {
      eventName,
      source: 'app',
      page: input.page,
      clientId,
      sessionId: SESSION_ID,
      properties: input.properties,
    });
  } catch {
    // 埋点失败不影响主流程
  }
}

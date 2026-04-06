import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/index';

type AppAnalyticsEventName =
  | 'app_membership_exposure'
  | 'app_weekly_report_open'
  | 'app_growth_archive_share';

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


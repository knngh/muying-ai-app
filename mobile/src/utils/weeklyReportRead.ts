import { storage } from './storage'

const WEEKLY_REPORT_LAST_SEEN_ID_KEY = 'weekly_report_last_seen_id'

export async function getLastSeenWeeklyReportId() {
  return storage.get<string>(WEEKLY_REPORT_LAST_SEEN_ID_KEY)
}

export async function markWeeklyReportSeen(reportId: string) {
  await storage.set(WEEKLY_REPORT_LAST_SEEN_ID_KEY, reportId)
}

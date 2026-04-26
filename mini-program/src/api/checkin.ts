import api from './request'

export interface CheckinStatus {
  checkedInToday: boolean
  consecutiveDays: number
  totalDays: number
  pointsEarned?: number
}

export const checkinApi = {
  getStatus: () =>
    api.get<CheckinStatus>('/checkin/status'),

  checkin: () =>
    api.post<CheckinStatus>('/checkin'),
}

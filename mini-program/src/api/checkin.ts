import api from './request'

export interface CheckinStatus {
  checkedInToday: boolean
  currentStreak?: number
  consecutiveDays?: number
  streakCount?: number
  checkinDate?: string
  streakDates?: string[]
  totalDays?: number
  totalPoints?: number
  monthlyCheckins?: string[]
  pointsEarned?: number
  pointsAwarded?: number
  nextBonusAt?: number | null
  nextBonusPoints?: number | null
}

export const checkinApi = {
  getStatus: () =>
    api.get<CheckinStatus>('/checkin/status'),

  checkin: () =>
    api.post<CheckinStatus>('/checkin'),
}

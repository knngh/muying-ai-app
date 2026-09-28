import api from './index'

// ==================== 共享类型（起名库，复用 shared 定义） ====================

export type { NameGender, NameLibraryItem, NameLibraryQuery, NameLibraryResponse } from '../../../shared/types/name-library'
export {
  NAME_FAVORITES_KEY,
  MAX_NAME_FAVORITES,
  NAME_DISCLOSURE,
  nameFavoriteKey,
  readNameFavorites,
  nameCopyText,
} from '../../../shared/utils/name-library'

import type { NameLibraryItem, NameLibraryQuery, NameLibraryResponse } from '../../../shared/types/name-library'

// ==================== 生长档案与测量 ====================

export interface GrowthProfile {
  id: string
  userId: string
  name: string
  birthday: string | null
  gender: 0 | 1 | 2
  stageHint: string | null
}

export interface BabyMeasurement {
  id: string
  measuredAt: string
  metric: 'height' | 'weight' | 'head'
  value: number
  unit: string
  method: string | null
}

export interface GrowthProfileInput {
  name?: string
  birthday?: string | null
  gender?: 0 | 1 | 2
  stageHint?: string | null
}

export interface BabyMeasurementInput {
  measuredAt: string
  metric: BabyMeasurement['metric']
  value: number
  unit: string
  method?: string
  clientOperationId: string
}

export const growthApi = {
  getProfile: () => api.get<GrowthProfile>('/growth/profile'),
  upsertProfile: (data: GrowthProfileInput) => api.post<GrowthProfile>('/growth/profile', data),
  getMeasurements: (limit = 100) => api.get<BabyMeasurement[]>('/tool-records/growth', { params: { limit } }),
  createMeasurement: (data: BabyMeasurementInput) => api.post<BabyMeasurement>('/tool-records/growth', data),
}

// ==================== 疫苗目录与接种记录 ====================

export interface VaccineItem {
  id: string
  name: string
  nameEn?: string
  category: string
  description?: string
  preventDisease?: string
  sideEffects?: string
  contraindication?: string
  minMonth?: number | null
  maxMonth?: number | null
  doseCount?: number
  doseInterval?: number
}

export type VaccinationStatus = 'planned' | 'scheduled' | 'administered' | 'unconfirmed'

export interface VaccinationRecord {
  id: string
  vaccineName: string
  administeredAt: string
  status: VaccinationStatus
  doseNumber?: number | null
  note?: string | null
}

export interface VaccinationRecordInput {
  vaccineName: string
  administeredAt: string
  status: VaccinationStatus
  doseNumber?: number
  note?: string
  clientOperationId: string
}

export const vaccineApi = {
  // 排期表要全量（不传 monthAge，传了会被滤成"当前月龄适用"）
  getAll: () => api.get<{ list: VaccineItem[] }>('/vaccines').then((res) => res.list),
  getByMonthAge: (monthAge: number) =>
    api.get<{ list: VaccineItem[] }>('/vaccines', { params: { monthAge } }).then((res) => res.list),
}

export const vaccinationRecordApi = {
  list: (limit = 100) => api.get<VaccinationRecord[]>('/tool-records/vaccinations', { params: { limit } }),
  create: (data: VaccinationRecordInput) => api.post<VaccinationRecord>('/tool-records/vaccinations', data),
}

// ==================== 每日签到与积分 ====================

export interface CheckinStatus {
  checkedInToday: boolean
  currentStreak: number
  consecutiveDays: number
  streakDates: string[]
  totalDays: number
  totalPoints: number
  nextBonusAt: 3 | 7 | 14 | 30 | null
  nextBonusPoints: number | null
  monthlyCheckins: string[]
}

export interface CheckinResult extends Partial<CheckinStatus> {
  streakCount: number
  checkinDate: string
  alreadyCheckedIn?: boolean
  pointsEarned: number
}

export interface PointsLogEntry {
  id: string
  points: number
  balance: number
  source: string
  sourceId?: string
  description: string
  createdAt: string
}

export interface PointsLogPage {
  list: PointsLogEntry[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export const checkinApi = {
  checkin: () => api.post<CheckinResult>('/checkin'),
  getStatus: () => api.get<CheckinStatus>('/checkin/status'),
  getPointsLog: (page: number, pageSize = 20) =>
    api.get<PointsLogPage>('/checkin/points-log', { params: { page, pageSize } }),
}

// ==================== 起名库 ====================

export const namesApi = {
  getList: (params: NameLibraryQuery) => api.get<NameLibraryResponse>('/names', { params }),
}

export type { NameLibraryItem as NameItem }

import { create } from 'zustand'
import { checkinApi, type CheckinResult, type CheckinStatus, type PointsLogEntry } from '@/api/tools'

interface CheckinState {
  status: CheckinStatus | null
  logList: PointsLogEntry[]
  logPage: number
  logTotalPages: number
  logLoading: boolean
  loading: boolean
  error: string | null
  fetchStatus: () => Promise<void>
  performCheckin: () => Promise<CheckinResult | null>
  fetchLogPage: (page: number, append?: boolean) => Promise<void>
}

export const useCheckinStore = create<CheckinState>((set, get) => ({
  status: null,
  logList: [],
  logPage: 0,
  logTotalPages: 0,
  logLoading: false,
  loading: false,
  error: null,

  fetchStatus: async () => {
    set({ loading: true, error: null })
    try {
      const status = await checkinApi.getStatus()
      set({ status, loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '获取签到状态失败', loading: false })
    }
  },

  performCheckin: async () => {
    set({ loading: true, error: null })
    try {
      const result = await checkinApi.checkin()
      set({ loading: false })
      await Promise.all([get().fetchStatus(), get().fetchLogPage(1)])
      return result
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '签到失败', loading: false })
      return null
    }
  },

  fetchLogPage: async (page, append = false) => {
    set({ logLoading: true, error: null })
    try {
      const data = await checkinApi.getPointsLog(page)
      set((state) => ({
        logList: append ? [...state.logList, ...data.list] : data.list,
        logPage: data.pagination.page,
        logTotalPages: data.pagination.totalPages,
        logLoading: false,
      }))
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '获取积分记录失败', logLoading: false })
    }
  },
}))

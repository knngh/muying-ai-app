import { create } from 'zustand'
import dayjs from 'dayjs'
import { growthApi } from '@/api/tools'
import type { BabyMeasurement, BabyMeasurementInput, GrowthProfile, GrowthProfileInput } from '@/api/tools'

interface GrowthState {
  profile: GrowthProfile | null
  measurements: BabyMeasurement[]
  loading: boolean
  error: string | null
  fetchProfile: () => Promise<void>
  upsertProfile: (data: GrowthProfileInput) => Promise<void>
  fetchMeasurements: () => Promise<void>
  createMeasurement: (data: BabyMeasurementInput) => Promise<void>
}

export const useGrowthStore = create<GrowthState>((set) => ({
  profile: null,
  measurements: [],
  loading: false,
  error: null,

  fetchProfile: async () => {
    set({ loading: true, error: null })
    try {
      const profile = (await growthApi.getProfile()) as GrowthProfile | null
      set({ profile: profile || null, loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '获取生长档案失败', loading: false })
    }
  },

  upsertProfile: async (data) => {
    set({ loading: true, error: null })
    try {
      const profile = await growthApi.upsertProfile(data)
      set({ profile, loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '保存生长档案失败', loading: false })
    }
  },

  fetchMeasurements: async () => {
    set({ loading: true, error: null })
    try {
      const measurements = await growthApi.getMeasurements()
      set({ measurements: measurements || [], loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '获取测量记录失败', loading: false })
    }
  },

  createMeasurement: async (data) => {
    set({ loading: true, error: null })
    try {
      const created = await growthApi.createMeasurement(data)
      set((state) => ({
        // 新记录插入后按 measuredAt 倒序，日期统一用 dayjs 解析比较
        measurements: [created, ...state.measurements].sort(
          (a, b) => dayjs(b.measuredAt).valueOf() - dayjs(a.measuredAt).valueOf(),
        ),
        loading: false,
      }))
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '保存测量记录失败', loading: false })
    }
  },
}))

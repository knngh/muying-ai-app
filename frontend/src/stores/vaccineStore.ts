import { create } from 'zustand'
import {
  vaccineApi,
  vaccinationRecordApi,
  type VaccinationRecord,
  type VaccinationRecordInput,
  type VaccineItem,
} from '@/api/tools'

interface VaccineState {
  catalog: VaccineItem[]
  records: VaccinationRecord[]
  loading: boolean
  error: string | null
  fetchCatalog: () => Promise<void>
  fetchRecords: () => Promise<void>
  createRecord: (data: VaccinationRecordInput) => Promise<boolean>
}

export const useVaccineStore = create<VaccineState>((set) => ({
  catalog: [],
  records: [],
  loading: false,
  error: null,

  // 排期表要全量目录：绝不传 monthAge（传了会被后端滤成"当前月龄适用"）
  fetchCatalog: async () => {
    set({ loading: true, error: null })
    try {
      const catalog = await vaccineApi.getAll()
      set({ catalog, loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '获取疫苗目录失败', loading: false })
    }
  },

  fetchRecords: async () => {
    set({ loading: true, error: null })
    try {
      const records = await vaccinationRecordApi.list(100)
      set({ records, loading: false })
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '获取接种记录失败', loading: false })
    }
  },

  // 成功后把新记录插入 records 头部；返回是否成功供页面决定是否关闭 modal
  createRecord: async (data) => {
    set({ loading: true, error: null })
    try {
      const record = await vaccinationRecordApi.create(data)
      set((state) => ({ records: [record, ...state.records], loading: false }))
      return true
    } catch (error: unknown) {
      const err = error as { message?: string }
      set({ error: err.message || '创建接种记录失败', loading: false })
      return false
    }
  },
}))

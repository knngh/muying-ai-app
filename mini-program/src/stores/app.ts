import { defineStore } from 'pinia'
import { authApi } from '@/api/modules'
import type { User } from '@/api/modules'
import { syncPregnancyWeekStorage } from '@/utils'

export const useAppStore = defineStore('app', {
  state: () => ({
    user: null as User | null,
    isLoading: false,
  }),
  actions: {
    setUser(user: User | null) {
      this.user = user
      if (user) {
        uni.setStorageSync('user', user)
        const isPregnant = user.pregnancyStatus === 2 || user.pregnancyStatus === '2' || user.pregnancyStatus === 'pregnant'
        if (isPregnant && user.dueDate) {
          syncPregnancyWeekStorage(user.dueDate)
        } else {
          uni.removeStorageSync('userPregnancyWeek')
        }
      } else {
        uni.removeStorageSync('user')
        uni.removeStorageSync('userPregnancyWeek')
      }
    },
    setIsLoading(loading: boolean) {
      this.isLoading = loading
    },
    async fetchUser() {
      try {
        const userData = await authApi.me() as User
        this.setUser(userData)
      } catch (_e) {
        if (!uni.getStorageSync('token')) {
          this.setUser(null)
        }
      }
    },
  },
})

import { defineStore } from 'pinia'
import { authApi } from '@/api/modules'
import type { User } from '@/api/modules'

export const useAppStore = defineStore('app', {
  state: () => ({
    user: null as User | null,
    isLoading: false,
  }),
  actions: {
    setUser(user: User | null) {
      this.user = user
    },
    setIsLoading(loading: boolean) {
      this.isLoading = loading
    },
    async fetchUser() {
      try {
        const userData = await authApi.me() as User
        this.user = userData
      } catch (_e) {
        // 忽略错误
      }
    },
  },
})

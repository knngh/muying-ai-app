import { defineStore } from 'pinia'
import { authApi } from '@/api/modules'
import type { User } from '@/api/modules'
import dayjs from 'dayjs'
import { calculateDueDateFromPregnancyWeek, syncPregnancyWeekStorage } from '@/utils'

const normalizePregnancyStatus = (value: unknown) => {
  if (typeof value === 'number' && value >= 1 && value <= 3) return value

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()
    if (!trimmed) return undefined
    if (trimmed === 'preparing') return 1
    if (trimmed === 'pregnant') return 2
    if (trimmed === 'postpartum') return 3

    const numericValue = Number.parseInt(trimmed, 10)
    if (!Number.isNaN(numericValue) && numericValue >= 1 && numericValue <= 3) {
      return numericValue
    }
  }

  return undefined
}

const isPreparingUser = (user: User) => !user.dueDate && normalizePregnancyStatus(user.pregnancyStatus) === 1
const isPostpartumUser = (user: User) => (
  !user.dueDate && (
  user.pregnancyStatus === 3
  || user.pregnancyStatus === '3'
  || user.pregnancyStatus === 'postpartum'
  || !!user.babyBirthday
  )
)

const readStoredPregnancyWeek = () => {
  const rawValue = Number.parseInt(String(uni.getStorageSync('userPregnancyWeek') || ''), 10)
  if (Number.isNaN(rawValue) || rawValue < 1 || rawValue > 40) {
    return null
  }
  return rawValue
}

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
        if (user.dueDate && !isPostpartumUser(user)) {
          syncPregnancyWeekStorage(user.dueDate)
        } else if (isPostpartumUser(user) || isPreparingUser(user)) {
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
    async restoreDueDateFromStoredWeek(targetUser?: User | null) {
      const user = targetUser || this.user
      if (!user || user.dueDate || isPostpartumUser(user) || isPreparingUser(user)) {
        return user
      }

      const storedWeek = readStoredPregnancyWeek()
      if (!storedWeek) {
        return user
      }

      const dueDate = calculateDueDateFromPregnancyWeek(storedWeek)
      if (!dueDate) {
        return user
      }

      const updatedUser = await authApi.updateProfile({
        pregnancyStatus: 2,
        dueDate: dayjs(dueDate).format('YYYY-MM-DD'),
        babyBirthday: null,
      }) as User

      this.setUser(updatedUser)
      return updatedUser
    },
    async fetchUser() {
      try {
        const userData = await authApi.me() as User
        this.setUser(userData)
        await this.restoreDueDateFromStoredWeek(userData)
      } catch (_e) {
        if (!uni.getStorageSync('token')) {
          this.setUser(null)
        }
      }
    },
  },
})

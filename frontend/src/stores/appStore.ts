import { create } from 'zustand'
import type { User } from '@/api/modules'
import { storage } from '@/utils/storage'

const USER_STORAGE_KEY = 'app_user'

function readStoredUser(): User | null {
  const raw = storage.getItem(USER_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as User
  } catch {
    storage.removeItem(USER_STORAGE_KEY)
    return null
  }
}

interface AppState {
  user: User | null
  setUser: (user: User | null) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  user: readStoredUser(),
  setUser: (user) => {
    if (user) {
      storage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
    } else {
      storage.removeItem(USER_STORAGE_KEY)
    }
    set({ user })
  },
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
}))

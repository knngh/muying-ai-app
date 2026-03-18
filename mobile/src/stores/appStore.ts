import { create } from 'zustand'
import type { User } from '../api/modules'
import { authApi } from '../api/modules'

interface AppState {
  user: User | null
  isLoading: boolean
  token: string | null
  setUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
  setToken: (token: string | null) => void
  fetchUser: () => Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  isLoading: false,
  token: null,
  setUser: (user) => set({ user }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setToken: (token) => set({ token }),
  fetchUser: async () => {
    try {
      const userData = await authApi.me() as User
      set({ user: userData })
    } catch (_e) {
      // ignore
    }
  },
}))

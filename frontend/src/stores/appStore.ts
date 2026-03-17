import { create } from 'zustand'

interface User {
  id: string
  name: string
  avatar?: string
  phone?: string
  pregnancyWeek?: number
  dueDate?: string
}

interface AppState {
  user: User | null
  setUser: (user: User | null) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
}))
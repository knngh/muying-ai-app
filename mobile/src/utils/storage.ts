import AsyncStorage from '@react-native-async-storage/async-storage'

export const SESSION_STORAGE_KEYS = {
  token: 'token',
} as const

export const storage = {
  get: async <T>(key: string): Promise<T | null> => {
    const value = await AsyncStorage.getItem(key)
    if (value) {
      try { return JSON.parse(value) as T } catch { return value as unknown as T }
    }
    return null
  },
  set: async <T>(key: string, value: T): Promise<void> => {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  },
  remove: async (key: string): Promise<void> => {
    await AsyncStorage.removeItem(key)
  },
  clear: async (): Promise<void> => {
    await AsyncStorage.clear()
  },
}

export const sessionStorage = {
  getToken: async (): Promise<string | null> => AsyncStorage.getItem(SESSION_STORAGE_KEYS.token),
  setToken: async (token: string): Promise<void> => {
    await AsyncStorage.setItem(SESSION_STORAGE_KEYS.token, token)
  },
  clear: async (): Promise<void> => {
    await AsyncStorage.multiRemove(Object.values(SESSION_STORAGE_KEYS))
  },
}

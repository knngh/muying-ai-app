import AsyncStorage from '@react-native-async-storage/async-storage'

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

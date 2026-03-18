import axios, { InternalAxiosRequestConfig } from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { config } from '../config'

const BASE_URL = config.apiBaseUrl

// 缓存 token 避免频繁异步读取
let cachedToken: string | null = null

export async function updateCachedToken(): Promise<void> {
  cachedToken = await AsyncStorage.getItem('token')
}

// 主实例
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// 刷新用独立实例
const refreshClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
})

// Token 刷新队列
let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else reject(error)
  })
  failedQueue = []
}

// 导航引用（由 AppNavigator 设置）
let navigationReset: (() => void) | null = null
export function setNavigationReset(fn: () => void) {
  navigationReset = fn
}

// 请求拦截器
api.interceptors.request.use((config) => {
  if (cachedToken) {
    config.headers.Authorization = `Bearer ${cachedToken}`
  }
  return config
})

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res && typeof res === 'object' && 'code' in res) {
      if (res.code === 0) return res.data
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res
  },
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(api(originalRequest))
            },
            reject,
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const currentToken = await AsyncStorage.getItem('token')
      if (currentToken) {
        try {
          const res = await refreshClient.post('/auth/refresh', null, {
            headers: { Authorization: `Bearer ${currentToken}` },
          })
          const newToken = res.data?.data?.token
          if (newToken) {
            await AsyncStorage.setItem('token', newToken)
            cachedToken = newToken
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            processQueue(null, newToken)
            return api(originalRequest)
          }
        } catch (refreshError) {
          processQueue(refreshError, null)
        } finally {
          isRefreshing = false
        }
      }

      await AsyncStorage.removeItem('token')
      cachedToken = null
      navigationReset?.()
      return Promise.reject(error)
    }

    return Promise.reject(error)
  },
)

type ApiInstance = {
  get<T = unknown>(url: string, config?: object): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: object): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: object): Promise<T>
  patch<T = unknown>(url: string, data?: unknown, config?: object): Promise<T>
  delete<T = unknown>(url: string, config?: object): Promise<T>
}

export default api as unknown as ApiInstance

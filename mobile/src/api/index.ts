import axios, { InternalAxiosRequestConfig } from 'axios'
import { config } from '../config'
import { sessionStorage } from '../utils/storage'

const BASE_URL = config.apiBaseUrl

// 缓存 token 避免频繁异步读取
let cachedToken: string | null = null

export async function updateCachedToken(): Promise<void> {
  cachedToken = await sessionStorage.getToken()
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

async function clearSessionAndReset() {
  await sessionStorage.clear()
  cachedToken = null
  navigationReset?.()
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
      const currentToken = await sessionStorage.getToken()

      try {
        if (!currentToken) {
          throw new Error('登录状态已失效，请重新登录')
        }

        const res = await refreshClient.post('/auth/refresh', null, {
          headers: { Authorization: `Bearer ${currentToken}` },
        })
        const newToken = res.data?.data?.token
        if (!newToken) {
          throw new Error('登录状态已失效，请重新登录')
        }

        await sessionStorage.setToken(newToken)
        cachedToken = newToken
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        await clearSessionAndReset()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    const apiError = new Error(error.response?.data?.message || error.message || '请求失败') as Error & {
      status?: number
      code?: number
      data?: unknown
    }
    apiError.status = error.response?.status
    apiError.code = error.response?.data?.code
    apiError.data = error.response?.data?.data
    return Promise.reject(apiError)
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

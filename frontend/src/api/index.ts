import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { storage } from '../utils/storage'

// 创建主 axios 实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://212.64.29.211/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 用于 token 刷新的独立实例（无拦截器，避免循环）
const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://212.64.29.211/api/v1',
  timeout: 10000,
})

// Token 刷新：使用 Promise 锁避免竞态条件
let refreshPromise: Promise<string> | null = null

async function doRefreshToken(): Promise<string> {
  const currentToken = storage.getItem('token')
  if (!currentToken) throw new Error('No token')

  const res = await refreshClient.post('/auth/refresh', null, {
    headers: { Authorization: `Bearer ${currentToken}` },
  })
  const newToken = res.data?.data?.token
  if (!newToken) throw new Error('Refresh failed')

  storage.setItem('token', newToken)
  return newToken
}

function refreshToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = doRefreshToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = storage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 — 解包后端 { code: 0, data: ... } 格式
api.interceptors.response.use(
  (response) => {
    const res = response.data
    // 后端统一返回 { code: 0, message: 'success', data: ... }
    if (res && typeof res === 'object' && 'code' in res) {
      if (res.code === 0) {
        return res.data
      }
      // 业务错误
      const error = new Error(res.message || '请求失败')
      return Promise.reject(error)
    }
    // 兼容非标准格式（如健康检查等直接返回的接口）
    return res
  },
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // 401 处理：尝试刷新 token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const newToken = await refreshToken()
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch {
        // 刷新失败，清除 token 跳转登录
        storage.removeItem('token')
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    // 其他错误
    const message = error.response?.data?.message || error.message
    if (error.response) {
      switch (error.response.status) {
        case 403:
          console.error('拒绝访问:', message)
          break
        case 404:
          console.error('资源不存在:', message)
          break
        case 500:
          console.error('服务器错误:', message)
          break
        default:
          console.error('请求失败:', message)
      }
    }
    return Promise.reject(error)
  }
)

// TypeScript 类型覆盖：拦截器已解包，api.get<T>() 直接返回 Promise<T>
type ApiInstance = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
}

export default api as unknown as ApiInstance

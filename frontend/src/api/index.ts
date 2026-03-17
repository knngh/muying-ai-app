import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'

// 创建主 axios 实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 用于 token 刷新的独立实例（无拦截器，避免循环）
const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1',
  timeout: 10000,
})

// Token 刷新队列
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) {
      resolve(token)
    } else {
      reject(error)
    }
  })
  failedQueue = []
}

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
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
      if (isRefreshing) {
        // 正在刷新中，加入队列等待
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

      const currentToken = localStorage.getItem('token')
      if (currentToken) {
        try {
          const res = await refreshClient.post('/auth/refresh', null, {
            headers: { Authorization: `Bearer ${currentToken}` },
          })
          const newToken = res.data?.data?.token
          if (newToken) {
            localStorage.setItem('token', newToken)
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            processQueue(null, newToken)
            return api(originalRequest)
          }
        } catch (_refreshError) {
          processQueue(_refreshError, null)
        } finally {
          isRefreshing = false
        }
      }

      // 刷新失败，清除 token 跳转登录
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(error)
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

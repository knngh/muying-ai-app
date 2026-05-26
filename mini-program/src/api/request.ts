import { clearLocalSession } from '@/utils'

// uni.request 封装 - 对标 Web 端 Axios 拦截器
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://beihu.me/api/v1'

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  data?: unknown
  params?: Record<string, unknown>
  header?: Record<string, string>
  timeout?: number
}

interface RequestConfig {
  header?: Record<string, string>
  timeout?: number
}

interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

function parseResponseBody<T>(data: unknown): ApiResponse<T> | T {
  if (typeof data !== 'string') {
    return data as ApiResponse<T> | T
  }

  try {
    return JSON.parse(data) as ApiResponse<T> | T
  } catch {
    return data as T
  }
}

function unwrapApiResponse<T>(data: unknown): T {
  const body = parseResponseBody<T>(data)
  if (body && typeof body === 'object' && 'code' in body) {
    const apiBody = body as ApiResponse<T>
    if (apiBody.code === 0) {
      return apiBody.data
    }
    throw new Error(apiBody.message || '请求失败')
  }

  return body as T
}

function buildUrl(url: string, params?: Record<string, unknown>): string {
  if (!params) return BASE_URL + url
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  return BASE_URL + url + (query ? '?' + query : '')
}

export function resolveUploadUrl(url: string): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url

  const apiOrigin = BASE_URL.replace(/\/api\/v\d+\/?$/, '').replace(/\/$/, '')
  return `${apiOrigin}${url.startsWith('/') ? url : `/${url}`}`
}

async function request<T = unknown>(options: RequestOptions): Promise<T> {
  const token = uni.getStorageSync('token')
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.header || {}),
  }
  if (token) {
    header['Authorization'] = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: buildUrl(options.url, options.params),
      method: (options.method || 'GET') as any,
      data: options.data as AnyObject,
      header,
      timeout: options.timeout,
      success: async (res) => {
        const statusCode = res.statusCode
        const body = parseResponseBody<T>(res.data) as ApiResponse<T>

        // 401 处理：清理本地登录态，不做页面跳转（由各页面自行处理未登录状态）
        if (statusCode === 401) {
          clearLocalSession()
          reject(new Error(body?.message || '登录已过期'))
          return
        }

        // 正常响应处理
        try {
          resolve(unwrapApiResponse<T>(body))
        } catch (error) {
          reject(error)
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络请求失败'))
      },
    })
  })
}

async function upload<T = unknown>(
  url: string,
  filePath: string,
  name = 'file',
  formData?: Record<string, unknown>,
): Promise<T> {
  const token = uni.getStorageSync('token')
  const header: Record<string, string> = {}
  if (token) {
    header.Authorization = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: buildUrl(url),
      filePath,
      name,
      formData: formData as AnyObject,
      header,
      success: (res) => {
        const statusCode = res.statusCode
        const body = parseResponseBody<T>(res.data)

        if (statusCode === 401) {
          clearLocalSession()
          reject(new Error((body as ApiResponse<T>)?.message || '登录已过期'))
          return
        }

        try {
          resolve(unwrapApiResponse<T>(body))
        } catch (error) {
          reject(error)
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '图片上传失败'))
      },
    })
  })
}

// 带重试的请求 — 网络失败自动重试 1 次（2s 延迟）
async function requestWithRetry<T = unknown>(options: RequestOptions): Promise<T> {
  try {
    return await request<T>(options)
  } catch (error: any) {
    const isNetworkError = error?.message?.includes('网络请求失败') || error?.message?.includes('request:fail')
    if (isNetworkError) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      return request<T>(options)
    }
    throw error
  }
}

// 导出便捷方法（仅 GET 使用网络重试，避免非幂等写操作被重复提交）
export const api = {
  get: <T = unknown>(url: string, params?: Record<string, unknown>, config?: RequestConfig) =>
    requestWithRetry<T>({ url, method: 'GET', params, ...config }),

  post: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) =>
    request<T>({ url, method: 'POST', data, ...config }),

  put: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) =>
    request<T>({ url, method: 'PUT', data, ...config }),

  patch: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) =>
    request<T>({ url, method: 'PATCH', data, ...config }),

  delete: <T = unknown>(url: string, params?: Record<string, unknown>, config?: RequestConfig) =>
    request<T>({ url, method: 'DELETE', params, ...config }),

  upload: <T = unknown>(url: string, filePath: string, name?: string, formData?: Record<string, unknown>) =>
    upload<T>(url, filePath, name, formData),
}

export default api

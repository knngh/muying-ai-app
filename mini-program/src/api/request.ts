// uni.request 封装 - 对标 Web 端 Axios 拦截器
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://beihu.me/api/v1'

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  data?: unknown
  params?: Record<string, unknown>
  header?: Record<string, string>
}

interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

function buildUrl(url: string, params?: Record<string, unknown>): string {
  if (!params) return BASE_URL + url
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  return BASE_URL + url + (query ? '?' + query : '')
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
      success: async (res) => {
        const statusCode = res.statusCode
        const body = res.data as ApiResponse<T>

        // 401 处理：只清理 token，不做页面跳转（由各页面自行处理未登录状态）
        if (statusCode === 401) {
          uni.removeStorageSync('token')
          reject(new Error(body?.message || '登录已过期'))
          return
        }

        // 正常响应处理
        if (body && typeof body === 'object' && 'code' in body) {
          if (body.code === 0) {
            resolve(body.data)
          } else {
            reject(new Error(body.message || '请求失败'))
          }
        } else {
          resolve(body as unknown as T)
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络请求失败'))
      },
    })
  })
}

// 导出便捷方法
export const api = {
  get: <T = unknown>(url: string, params?: Record<string, unknown>) =>
    request<T>({ url, method: 'GET', params }),

  post: <T = unknown>(url: string, data?: unknown) =>
    request<T>({ url, method: 'POST', data }),

  put: <T = unknown>(url: string, data?: unknown) =>
    request<T>({ url, method: 'PUT', data }),

  patch: <T = unknown>(url: string, data?: unknown) =>
    request<T>({ url, method: 'PATCH', data }),

  delete: <T = unknown>(url: string, params?: Record<string, unknown>) =>
    request<T>({ url, method: 'DELETE', params }),
}

export default api

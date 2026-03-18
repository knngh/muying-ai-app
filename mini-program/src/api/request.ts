// uni.request 封装 - 对标 Web 端 Axios 拦截器
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else reject(error)
  })
  failedQueue = []
}

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

        // 401 处理：尝试刷新 token
        if (statusCode === 401) {
          if (isRefreshing) {
            try {
              const newToken = await new Promise<string>((res2, rej2) => {
                failedQueue.push({ resolve: res2, reject: rej2 })
              })
              header['Authorization'] = `Bearer ${newToken}`
              // 重试请求
              uni.request({
                url: buildUrl(options.url, options.params),
                method: (options.method || 'GET') as any,
                data: options.data as AnyObject,
                header,
                success: (retryRes) => {
                  const retryBody = retryRes.data as ApiResponse<T>
                  if (retryBody && retryBody.code === 0) {
                    resolve(retryBody.data)
                  } else {
                    reject(new Error(retryBody?.message || '请求失败'))
                  }
                },
                fail: (err) => reject(err),
              })
            } catch (err) {
              reject(err)
            }
            return
          }

          isRefreshing = true
          const currentToken = uni.getStorageSync('token')
          if (currentToken) {
            try {
              const refreshRes = await new Promise<UniApp.RequestSuccessCallbackResult>((res2, rej2) => {
                uni.request({
                  url: BASE_URL + '/auth/refresh',
                  method: 'POST',
                  header: { Authorization: `Bearer ${currentToken}` },
                  success: res2,
                  fail: rej2,
                })
              })
              const refreshBody = refreshRes.data as ApiResponse<{ token: string }>
              if (refreshBody?.code === 0 && refreshBody.data?.token) {
                const newToken = refreshBody.data.token
                uni.setStorageSync('token', newToken)
                processQueue(null, newToken)
                // 重试原始请求
                header['Authorization'] = `Bearer ${newToken}`
                uni.request({
                  url: buildUrl(options.url, options.params),
                  method: (options.method || 'GET') as any,
                  data: options.data as AnyObject,
                  header,
                  success: (retryRes) => {
                    const retryBody = retryRes.data as ApiResponse<T>
                    if (retryBody && retryBody.code === 0) {
                      resolve(retryBody.data)
                    } else {
                      reject(new Error(retryBody?.message || '请求失败'))
                    }
                  },
                  fail: (err) => reject(err),
                })
                isRefreshing = false
                return
              } else {
                // Refresh token failed (code !== 0), reject all pending requests
                processQueue(new Error('Token刷新失败'), null)
              }
            } catch (_e) {
              processQueue(_e, null)
            }
            isRefreshing = false
          }

          // 刷新失败，跳转登录
          uni.removeStorageSync('token')
          uni.navigateTo({ url: '/pages/login/index' })
          reject(new Error('登录已过期'))
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

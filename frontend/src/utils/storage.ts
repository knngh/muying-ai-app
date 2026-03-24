/**
 * 安全的 localStorage 封装
 * 处理隐私浏览模式和 quota 超限等异常
 */
class SafeStorage {
  private fallback = new Map<string, string>()

  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return this.fallback.get(key) ?? null
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      this.fallback.set(key, value)
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      this.fallback.delete(key)
    }
  }
}

export const storage = new SafeStorage()

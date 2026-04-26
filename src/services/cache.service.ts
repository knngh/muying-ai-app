/**
 * 内存缓存服务
 * 用于缓存热门数据，减少数据库查询
 */

interface CacheItem<T> {
  data: T;
  expireAt: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memoryUsage: string;
}

class MemoryCache {
  private cache: Map<string, CacheItem<unknown>> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  private maxSize: number = 1000; // 最大缓存条目数
  private defaultTTL: number = 5 * 60 * 1000; // 默认5分钟

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      this.misses++;
      return null;
    }

    // 检查是否过期
    if (Date.now() > item.expireAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return item.data as T;
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // 如果缓存已满，删除最早创建的项
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const expireAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, {
      data,
      expireAt,
      createdAt: Date.now()
    });
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 删除匹配前缀的所有缓存
   */
  deleteByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    // 估算内存使用
    let memoryUsage = 0;
    for (const [key, value] of this.cache.entries()) {
      memoryUsage += key.length * 2; // 字符串字节
      try {
        memoryUsage += JSON.stringify(value.data, (_k, v) => typeof v === 'bigint' ? v.toString() : v).length * 2;
      } catch {
        memoryUsage += 64; // fallback estimate for non-serializable data
      }
    }

    return {
      hits: this.hits,
      misses: this.misses,
      keys: this.cache.size,
      memoryUsage: `${(memoryUsage / 1024).toFixed(2)} KB`
    };
  }

  /**
   * 获取命中率
   */
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : (this.hits / total * 100);
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expireAt) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * 删除最早的缓存项
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.createdAt < oldestTime) {
        oldestTime = item.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// 导出单例实例
export const cache = new MemoryCache();

// 缓存键常量
export const CacheKeys = {
  // 文章相关
  ARTICLES_LIST: (params: string) => `articles:list:${params}`,
  ARTICLE_DETAIL: (slug: string) => `article:detail:${slug}`,
  ARTICLE_RELATED: (id: string, limit?: number) => `article:related:${id}:${limit ?? 'default'}`,
  ARTICLES_POPULAR: 'articles:popular',
  ARTICLES_RECOMMENDED: 'articles:recommended',
  ARTICLES_AUTHORITY: 'articles:authority',
  ARTICLES_AUTHORITY_FILTERED: (params: string) => `articles:authority:filtered:${params}`,
  
  // 分类相关
  CATEGORIES_ALL: 'categories:all',
  CATEGORY_DETAIL: (slug: string) => `category:detail:${slug}`,
  
  // 标签相关
  TAGS_ALL: 'tags:all',
  TAG_ARTICLES: (slug: string, page: number) => `tag:articles:${slug}:${page}`,
  
  // 疫苗相关
  VACCINES_ALL: 'vaccines:all',
  VACCINE_DETAIL: (id: string) => `vaccine:detail:${id}`,
};

// 缓存TTL常量（毫秒）
export const CacheTTL = {
  SHORT: 1 * 60 * 1000,      // 1分钟
  MEDIUM: 5 * 60 * 1000,     // 5分钟
  LONG: 30 * 60 * 1000,      // 30分钟
  HOUR: 60 * 60 * 1000,      // 1小时
};

// 定期清理过期缓存（每5分钟）
const cacheCleanupTimer = setInterval(() => {
  const cleaned = cache.cleanup();
  if (cleaned > 0) {
    console.log(`[Cache] Cleaned ${cleaned} expired items`);
  }
}, 5 * 60 * 1000);
cacheCleanupTimer.unref();

export default cache;

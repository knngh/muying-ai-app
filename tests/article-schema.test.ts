import { getArticlesQuery, relatedArticlesQuery } from '../src/schemas/article.schema';
import { CacheKeys } from '../src/services/cache.service';

describe('article schemas and cache keys', () => {
  it('bounds article list filters used by cache keys and database queries', () => {
    expect(getArticlesQuery.parse({ page: '1', pageSize: '20', sort: 'popular', keyword: '辅食' })).toEqual({
      page: 1,
      pageSize: 20,
      sort: 'popular',
      keyword: '辅食',
    });
    expect(getArticlesQuery.safeParse({ keyword: 'a'.repeat(101) }).success).toBe(false);
    expect(getArticlesQuery.safeParse({ source: 'a'.repeat(121) }).success).toBe(false);
    expect(getArticlesQuery.safeParse({ difficulty: 'a'.repeat(41) }).success).toBe(false);
  });

  it('bounds related article limits', () => {
    expect(relatedArticlesQuery.parse({})).toEqual({ limit: 5 });
    expect(relatedArticlesQuery.parse({ limit: '20' })).toEqual({ limit: 20 });
    expect(relatedArticlesQuery.safeParse({ limit: '0' }).success).toBe(false);
    expect(relatedArticlesQuery.safeParse({ limit: '21' }).success).toBe(false);
  });

  it('includes related limit in cache key', () => {
    expect(CacheKeys.ARTICLE_RELATED('123', 1)).toBe('article:related:123:1');
    expect(CacheKeys.ARTICLE_RELATED('123', 5)).toBe('article:related:123:5');
  });
});

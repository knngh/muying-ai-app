import { getCategoriesQuery } from '../src/schemas/category.schema';
import { slugParam } from '../src/schemas/common.schema';

describe('category and slug schemas', () => {
  it('validates category filters before controller BigInt parsing', () => {
    expect(getCategoriesQuery.parse({ level: '2', parentId: '123', isActive: 'true' })).toEqual({
      level: 2,
      parentId: '123',
      isActive: 'true',
    });
    expect(getCategoriesQuery.parse({ parentId: 'null' })).toEqual({ parentId: 'null' });
    expect(getCategoriesQuery.safeParse({ parentId: 'abc' }).success).toBe(false);
    expect(getCategoriesQuery.safeParse({ level: '0' }).success).toBe(false);
  });

  it('accepts bounded slugs and rejects unsafe slug values', () => {
    expect(slugParam.parse({ slug: 'pregnancy_week-12' })).toEqual({ slug: 'pregnancy_week-12' });
    expect(slugParam.safeParse({ slug: '../secret' }).success).toBe(false);
    expect(slugParam.safeParse({ slug: 'a'.repeat(161) }).success).toBe(false);
  });
});

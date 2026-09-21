import { filterNameLibrary } from '../src/services/name-library.service';
import { getNamesQuery } from '../src/schemas/name-library.schema';

describe('name library service', () => {
  it('filters a pre-generated name library by surname, gender and given-name length', () => {
    const result = filterNameLibrary({
      surname: '林',
      gender: 'girl',
      nameLength: 2,
      page: 1,
      pageSize: 20,
    });

    expect(result.list.length).toBeGreaterThan(0);
    expect(result.list.every((item) => item.gender === 'girl')).toBe(true);
    expect(result.list.every((item) => item.givenName.length === 2)).toBe(true);
    expect(result.list.every((item) => item.fullName.startsWith('林'))).toBe(true);
    expect(result.pagination.total).toBe(result.list.length);
  });

  it('removes names containing any avoided character', () => {
    const result = filterNameLibrary({
      avoid: '安,宁',
      page: 1,
      pageSize: 100,
    });

    expect(result.list.every((item) => !/[安宁]/u.test(item.givenName))).toBe(true);
  });

  it('uses stable pagination for the same filters', () => {
    const first = filterNameLibrary({ page: 1, pageSize: 2 });
    const second = filterNameLibrary({ page: 2, pageSize: 2 });

    expect(first.list).toHaveLength(2);
    expect(second.list).toHaveLength(2);
    expect(first.list[0].id).not.toBe(second.list[0].id);
    expect(first.pagination.totalPages).toBeGreaterThan(1);
  });

  it('offers single-character names with the same disclosure as double-character names', () => {
    const result = filterNameLibrary({ surname: '欧阳', nameLength: 1 });
    expect(result.list.length).toBeGreaterThan(0);
    expect(result.list.every(item => Array.from(item.givenName).length === 1)).toBe(true);
    expect(result.list.every(item => item.fullName === `欧阳${item.givenName}`)).toBe(true);
    expect(result.disclosure).toContain('AI');
    expect(result.list.every(item => item.contentOrigin === 'ai_assisted')).toBe(true);
    expect(result.list.some(item => 'popularityScore' in item)).toBe(false);
  });

  it('returns a stable empty page without changing total for an out-of-range page', () => {
    const first = filterNameLibrary({ pageSize: 2 });
    const beyond = filterNameLibrary({ page: 100, pageSize: 2 });
    expect(beyond.list).toEqual([]);
    expect(beyond.pagination.total).toBe(first.pagination.total);
  });

  it('rejects malformed filters at the API boundary', () => {
    for (const query of [
      { surname: '<script>' }, { surname: 'abc' }, { gender: 'unknown' },
      { nameLength: 3 }, { nameLength: 1.5 }, { page: 0 }, { pageSize: 51 },
      { page: 'Infinity' }, { avoid: ['安', '宁'] },
    ]) {
      expect(getNamesQuery.safeParse(query).success).toBe(false);
    }
    expect(getNamesQuery.parse({ surname: ' 欧阳 ', nameLength: '1' })).toMatchObject({
      surname: '欧阳', nameLength: 1, page: 1, pageSize: 20,
    });
  });
});

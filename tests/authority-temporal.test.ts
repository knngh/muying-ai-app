import { resolveReliableAuthorityUpdatedAt } from '../src/utils/authority-temporal';

describe('authority temporal metadata', () => {
  it('drops volatile source timestamps that are close to fetch time without a reliable marker', () => {
    const updatedAt = resolveReliableAuthorityUpdatedAt({
      sourceId: 'mayo-clinic-zh',
      updatedAt: '2026-05-26T09:38:33.000Z',
      fetchedAt: '2026-05-26T01:35:17.000Z',
    });

    expect(updatedAt).toBeNull();
  });

  it('keeps explicit article-level timestamps even when they are close to fetch time', () => {
    const updatedAt = resolveReliableAuthorityUpdatedAt({
      sourceId: 'who',
      updatedAt: '2026-05-26T21:00:27.000Z',
      fetchedAt: '2026-05-27T04:02:56.561Z',
      updatedAtSource: 'article_published_time',
    });

    expect(updatedAt?.toISOString()).toBe('2026-05-26T21:00:27.000Z');
  });

  it('drops HTTP last-modified timestamps even when they are not near fetch time', () => {
    const updatedAt = resolveReliableAuthorityUpdatedAt({
      sourceId: 'aap',
      updatedAt: '2026-05-26T00:10:13.000Z',
      fetchedAt: '2026-05-27T00:10:17.000Z',
      updatedAtSource: 'http_last_modified',
    });

    expect(updatedAt).toBeNull();
  });
});

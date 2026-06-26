/**
 * DB-mocked coverage for the incremental-discovery backlog rotation, the
 * content_hash gating that freezes updated_at on unchanged documents, and the
 * conditional-fetch 304 "not modified" skip. The Prisma client is mocked so we
 * can assert the SQL/parameters each helper issues without a live database.
 */

const queryRawUnsafe = jest.fn();
const executeRawUnsafe = jest.fn();

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    $queryRawUnsafe: (...args: unknown[]) => queryRawUnsafe(...args),
    $executeRawUnsafe: (...args: unknown[]) => executeRawUnsafe(...args),
  },
}));

import { getAuthoritySourceConfig } from '../src/config/authority-sources';
import {
  fetchAuthorityDocument,
  loadPendingDiscoveredUrls,
  persistDiscoveredAuthorityUrls,
  persistNormalizedAuthorityDocument,
} from '../src/services/authority-sync.service';

// information_schema lookups in ensureAuthoritySyncTables / ensureTableColumn
// should report that every column already exists so no ALTER is attempted.
function defaultQueryImpl(sql: string): unknown[] {
  if (/information_schema/i.test(sql)) {
    return [{ count: 1 }];
  }
  return [];
}

beforeEach(() => {
  queryRawUnsafe.mockReset();
  executeRawUnsafe.mockReset();
  queryRawUnsafe.mockImplementation((sql: string) => defaultQueryImpl(sql));
  executeRawUnsafe.mockResolvedValue(undefined);
});

describe('discovered-url backlog rotation', () => {
  it('loads only pending rows scoped to the source with the budget LIMIT', async () => {
    const source = getAuthoritySourceConfig('chinacdc-nutrition')!;
    queryRawUnsafe.mockImplementation((sql: string) => {
      if (/information_schema/i.test(sql)) {
        return [{ count: 1 }];
      }
      if (/FROM authority_discovered_urls/i.test(sql) && /status = 'pending'/i.test(sql)) {
        return [
          { sourceId: source.id, url: 'https://www.chinacdc.cn/a.html', discoveredAt: new Date('2025-01-01T00:00:00Z'), priority: 100, lastModified: '2025-01-01' },
          { sourceId: source.id, url: 'https://www.chinacdc.cn/b.html', discoveredAt: null, priority: 80, lastModified: null },
        ];
      }
      return [];
    });

    const batch = await loadPendingDiscoveredUrls(source, 2);

    const selectCall = queryRawUnsafe.mock.calls.find(
      ([sql]) => typeof sql === 'string' && /FROM authority_discovered_urls/i.test(sql) && /status = 'pending'/i.test(sql),
    );
    expect(selectCall).toBeDefined();
    expect(String(selectCall![0])).toContain('LIMIT 2');
    expect(selectCall![1]).toBe(source.id);

    expect(batch).toEqual([
      { url: 'https://www.chinacdc.cn/a.html', sourceId: source.id, discoveredAt: '2025-01-01T00:00:00.000Z', priority: 100, lastModified: '2025-01-01' },
      expect.objectContaining({ url: 'https://www.chinacdc.cn/b.html', sourceId: source.id, priority: 80, lastModified: undefined }),
    ]);
  });

  it('upserts the full candidate set and only re-opens rows whose lastmod is newer than last fetch', async () => {
    await persistDiscoveredAuthorityUrls([
      { url: 'https://www.chinacdc.cn/a.html', sourceId: 'chinacdc-nutrition', discoveredAt: '2025-06-01T00:00:00Z', priority: 100, lastModified: '2025-05-01' },
      { url: 'https://www.chinacdc.cn/b.html', sourceId: 'chinacdc-nutrition', discoveredAt: '2025-06-01T00:00:00Z', priority: 80 },
    ]);

    const upserts = executeRawUnsafe.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && /INSERT INTO authority_discovered_urls/i.test(sql),
    );
    expect(upserts).toHaveLength(2);

    const sql = String(upserts[0][0]);
    expect(sql).toContain('ON DUPLICATE KEY UPDATE');
    // The status only resets to pending when the normalized lastmod is newer
    // than the previous fetch, otherwise the existing status is preserved.
    expect(sql).toMatch(/status = CASE[\s\S]*last_fetched_at IS NULL OR \? > last_fetched_at[\s\S]*THEN 'pending'[\s\S]*ELSE status/);
  });
});

describe('content_hash gating on normalized documents', () => {
  it('forwards the content hash and only refreshes updated_at when the hash changes', async () => {
    const document = {
      sourceId: 'who',
      sourceOrg: 'WHO',
      sourceUrl: 'https://www.who.int/example',
      title: 'Example guidance',
      updatedAt: '2025-06-01T00:00:00Z',
      audience: '孕妇',
      topic: 'pregnancy',
      region: 'GLOBAL',
      riskLevelDefault: 'green' as const,
      summary: 'Summary.',
      contentText: 'Body content.',
      metadataJson: {},
      publishStatus: 'draft' as const,
    };

    await persistNormalizedAuthorityDocument(document, 'hash-123');

    const call = executeRawUnsafe.mock.calls.find(
      ([sql]) => typeof sql === 'string' && /INSERT INTO authority_normalized_documents/i.test(sql),
    );
    expect(call).toBeDefined();
    const sql = String(call![0]);
    expect(sql).toMatch(/updated_at = CASE[\s\S]*content_hash IS NULL OR content_hash <> VALUES\(content_hash\)[\s\S]*ELSE updated_at/);
    // The content hash is bound as the final parameter.
    expect(call![call!.length - 1]).toBe('hash-123');
  });

  it('passes null when no content hash is supplied so updated_at follows the new value', async () => {
    const document = {
      sourceId: 'who',
      sourceOrg: 'WHO',
      sourceUrl: 'https://www.who.int/example',
      title: 'Example guidance',
      updatedAt: '2025-06-01T00:00:00Z',
      audience: '孕妇',
      topic: 'pregnancy',
      region: 'GLOBAL',
      riskLevelDefault: 'green' as const,
      summary: 'Summary.',
      contentText: 'Body content.',
      metadataJson: {},
      publishStatus: 'draft' as const,
    };

    await persistNormalizedAuthorityDocument(document);

    const call = executeRawUnsafe.mock.calls.find(
      ([sql]) => typeof sql === 'string' && /INSERT INTO authority_normalized_documents/i.test(sql),
    );
    expect(call![call!.length - 1]).toBeNull();
  });
});

describe('conditional fetch 304 handling', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends prior validators and returns a not-modified marker on 304 without a body', async () => {
    const source = getAuthoritySourceConfig('who')!;
    const url = 'https://www.who.int/example';

    queryRawUnsafe.mockImplementation((sql: string) => {
      if (/information_schema/i.test(sql)) {
        return [{ count: 1 }];
      }
      if (/FROM authority_raw_documents/i.test(sql)) {
        return [{ etag: '"abc"', lastModified: 'Wed, 01 Jan 2025 00:00:00 GMT' }];
      }
      return [];
    });

    const fetchMock = jest.fn().mockResolvedValue(
      new Response(null, {
        status: 304,
        headers: { etag: '"abc"' },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchAuthorityDocument(source, url);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['If-None-Match']).toBe('"abc"');
    expect(init.headers['If-Modified-Since']).toBe('Wed, 01 Jan 2025 00:00:00 GMT');

    expect(result).toMatchObject({
      httpStatus: 304,
      notModified: true,
      rawBody: '',
      contentHash: '',
    });
    // A 304 must never persist a new raw document row.
    expect(executeRawUnsafe.mock.calls.some(
      ([sql]) => typeof sql === 'string' && /INSERT IGNORE INTO authority_raw_documents/i.test(sql),
    )).toBe(false);
  });
});

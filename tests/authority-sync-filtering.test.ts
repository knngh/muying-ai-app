import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const queryRawUnsafe = jest.fn();
const executeRawUnsafe = jest.fn();

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    $queryRawUnsafe: (...args: unknown[]) => queryRawUnsafe(...args),
    $executeRawUnsafe: (...args: unknown[]) => executeRawUnsafe(...args),
  },
}));

describe('authority sync content filtering', () => {
  beforeEach(() => {
    queryRawUnsafe.mockReset();
    executeRawUnsafe.mockReset();
  });

  it('counts an HTTP 200 school-age article as filtered instead of a fetch failure', async () => {
    const originalCwd = process.cwd();
    const originalFetch = global.fetch;
    const tempCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-filtering-'));
    const sourceId = 'chinacdc-nutrition';
    const url = 'https://www.chinacdc.cn/jkkp/yyjk/rqyy/202408/t20240825_295585.html';
    const body = `<title>中国疾病预防控制中心</title>
      <h5><a>我国6~17岁学龄儿童主要食物摄入不均衡</a></h5>
      <div class="TRS_Editor"><p>${'学龄儿童青少年膳食调查分析了主要食物摄入与营养状况，研究对象为6至17岁在校学生。'.repeat(12)}</p></div>`;

    queryRawUnsafe.mockImplementation((sql: string) => {
      if (/information_schema/i.test(sql)) return Promise.resolve([{ count: 1 }]);
      if (/COUNT\(\*\) AS count[\s\S]*FROM authority_discovered_urls/i.test(sql)) return Promise.resolve([{ count: 0 }]);
      if (/FROM authority_discovered_urls[\s\S]*status = 'pending'[\s\S]*ORDER BY/i.test(sql)) {
        return Promise.resolve([{ sourceId, url, discoveredAt: new Date('2026-11-09T00:00:00Z'), priority: 100, lastModified: null }]);
      }
      return Promise.resolve([]);
    });
    executeRawUnsafe.mockResolvedValue(0);
    global.fetch = jest.fn().mockImplementation((input: string | URL) => Promise.resolve(
      new Response(String(input) === url ? body : '<html><body></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    )) as unknown as typeof fetch;

    process.chdir(tempCwd);
    jest.resetModules();
    try {
      const { syncAuthoritySource } = require('../src/services/authority-sync.service');
      const summary = await syncAuthoritySource(sourceId, 'incremental', { publishVectorSnapshot: false });

      expect(summary).toMatchObject({ fetched: 1, normalized: 0, filtered: 1, failed: 0 });
      expect(executeRawUnsafe.mock.calls.some(([sql]) => /INSERT INTO authority_normalized_documents/i.test(sql))).toBe(false);
      expect(executeRawUnsafe.mock.calls.some(([sql, ...values]) => /UPDATE authority_discovered_urls/i.test(sql)
        && values.includes('done') && values.includes(url))).toBe(true);
    } finally {
      global.fetch = originalFetch;
      process.chdir(originalCwd);
      fs.rmSync(tempCwd, { recursive: true, force: true });
      jest.resetModules();
    }
  });

  it.each([
    { httpStatus: 404, expectedGone: 1, expectedFailed: 0, expectedQueueStatus: 'gone' },
    { httpStatus: 410, expectedGone: 1, expectedFailed: 0, expectedQueueStatus: 'gone' },
    { httpStatus: 403, expectedGone: 0, expectedFailed: 1, expectedQueueStatus: 'failed' },
  ])('records HTTP $httpStatus as $expectedQueueStatus without publishing content', async ({
    httpStatus, expectedGone, expectedFailed, expectedQueueStatus,
  }) => {
    const originalCwd = process.cwd();
    const originalFetch = global.fetch;
    const tempCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-http-status-'));
    const sourceId = 'chinacdc-nutrition';
    const url = 'https://www.chinacdc.cn/jkkp/yyjk/rqyy/202408/t20240825_295584.html';

    queryRawUnsafe.mockImplementation((sql: string) => {
      if (/information_schema/i.test(sql)) return Promise.resolve([{ count: 1 }]);
      if (/COUNT\(\*\) AS count[\s\S]*FROM authority_discovered_urls/i.test(sql)) return Promise.resolve([{ count: 0 }]);
      if (/FROM authority_discovered_urls[\s\S]*status = 'pending'[\s\S]*ORDER BY/i.test(sql)) {
        return Promise.resolve([{ sourceId, url, discoveredAt: new Date('2026-11-09T00:00:00Z'), priority: 100, lastModified: null }]);
      }
      return Promise.resolve([]);
    });
    executeRawUnsafe.mockResolvedValue(0);
    global.fetch = jest.fn().mockImplementation((input: string | URL) => Promise.resolve(
      new Response('<html><body>Source response</body></html>', {
        status: String(input) === url ? httpStatus : 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    )) as unknown as typeof fetch;

    process.chdir(tempCwd);
    jest.resetModules();
    try {
      const { syncAuthoritySource } = require('../src/services/authority-sync.service');
      const summary = await syncAuthoritySource(sourceId, 'incremental', { publishVectorSnapshot: false });

      expect(summary).toMatchObject({ fetched: 0, normalized: 0, filtered: 0, gone: expectedGone, failed: expectedFailed });
      expect(executeRawUnsafe.mock.calls.some(([sql]) => /INSERT INTO authority_normalized_documents/i.test(sql))).toBe(false);
      expect(executeRawUnsafe.mock.calls.some(([sql, ...values]) => /UPDATE authority_discovered_urls/i.test(sql)
        && values.includes(expectedQueueStatus) && values.includes(url))).toBe(true);
      expect(executeRawUnsafe.mock.calls.some(([sql, ...values]) => /UPDATE authority_discovered_urls/i.test(sql)
        && values.includes(expectedQueueStatus === 'gone' ? 'failed' : 'gone') && values.includes(url))).toBe(false);
    } finally {
      global.fetch = originalFetch;
      process.chdir(originalCwd);
      fs.rmSync(tempCwd, { recursive: true, force: true });
      jest.resetModules();
    }
  });

  it('defers the remaining queue after three consecutive access denials', async () => {
    const originalCwd = process.cwd();
    const originalFetch = global.fetch;
    const tempCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-denied-'));
    const sourceId = 'chinacdc-nutrition';
    const urls = Array.from({ length: 5 }, (_, i) => `https://www.chinacdc.cn/jkkp/yyjk/rqyy/202408/t20240825_${295584 + i}.html`);
    queryRawUnsafe.mockImplementation((sql: string) => {
      if (/information_schema/i.test(sql)) return Promise.resolve([{ count: 1 }]);
      if (/COUNT\(\*\) AS count[\s\S]*FROM authority_discovered_urls/i.test(sql)) return Promise.resolve([{ count: 5 }]);
      if (/FROM authority_discovered_urls[\s\S]*status = 'pending'[\s\S]*ORDER BY/i.test(sql)) {
        return Promise.resolve(urls.map(url => ({ sourceId, url, priority: 100 })));
      }
      return Promise.resolve([]);
    });
    executeRawUnsafe.mockResolvedValue(0);
    const request = jest.fn().mockImplementation((url: string) => Promise.resolve(new Response('Access denied', { status: urls.includes(url) ? 403 : 200 })));
    global.fetch = request;
    process.chdir(tempCwd);
    jest.resetModules();
    try {
      const { syncAuthoritySource } = require('../src/services/authority-sync.service');
      const summary = await syncAuthoritySource(sourceId, 'incremental', { publishVectorSnapshot: false });
      expect(summary.failed).toBe(3);
      expect(summary.error).toContain('403');
      expect(request.mock.calls.filter(([url]) => urls.includes(url))).toHaveLength(3);
      expect(executeRawUnsafe.mock.calls.some(([, ...values]) => values.includes(urls[3]))).toBe(false);
    } finally {
      global.fetch = originalFetch;
      process.chdir(originalCwd);
      fs.rmSync(tempCwd, { recursive: true, force: true });
      jest.resetModules();
    }
  });
});

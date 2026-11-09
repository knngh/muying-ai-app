import { warmKnowledgeLayoutBatch } from '../src/services/knowledge-layout-warmup.service';
import * as layout from '../src/services/knowledge-layout.service';

jest.mock('../src/services/knowledge-layout.service');
const mocked = jest.mocked(layout);
const originalFetch = global.fetch;
const text = '喂养原则\n孩子满6月龄后添加辅食。';
const revision = '2026-11-01';
let cache: Record<string, layout.KnowledgeLayoutCacheRecord>;
let fetchMock: jest.Mock;

function inputs(content = text, count = 1) {
  fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () => ({ code: 0, data: url.includes('?')
    ? { list: Array.from({ length: count }, (_, i) => ({ slug: `article-${i}`, updatedAt: revision })), pagination: { totalPages: 1 } }
    : { content: 'Original English article', displayContent: content } }) }));
}

beforeEach(() => {
  jest.clearAllMocks();
  cache = {};
  mocked.loadKnowledgeLayoutCache.mockImplementation(() => cache);
  mocked.buildKnowledgeLayoutSourceFingerprint.mockImplementation(source => source);
  mocked.formatKnowledgeLayoutWithAI.mockResolvedValue({ verified: false, blocks: [], reason: 'validation_failed' });
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});
afterEach(() => { global.fetch = originalFetch; });

it('formats the displayed translation and bounds the number of AI calls', async () => {
  inputs('中文显示正文', 4);
  const report = await warmKnowledgeLayoutBatch(2);
  expect(report.failed).toBe(2);
  expect(mocked.formatKnowledgeLayoutWithAI.mock.calls.map(call => call[0])).toEqual(['中文显示正文', '中文显示正文']);
  expect(Object.keys(cache)).toHaveLength(2);
});

it('backs off failed inputs and retains originals instead of repeatedly calling the model', async () => {
  inputs();
  await warmKnowledgeLayoutBatch(1);
  mocked.formatKnowledgeLayoutWithAI.mockClear();
  await warmKnowledgeLayoutBatch(1);
  expect(mocked.formatKnowledgeLayoutWithAI).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it('refreshes the check timestamp for unchanged verified content without another model call', async () => {
  inputs();
  cache['article-0'] = { slug: 'article-0', sourceFingerprint: text, blocks: [{ type: 'paragraph', text }], inputRevision: revision, updatedAt: '2020-01-01' };
  await warmKnowledgeLayoutBatch(1);
  expect(Date.parse(cache['article-0'].updatedAt)).toBeGreaterThan(Date.now() - 10000);
  expect(mocked.saveKnowledgeLayoutCache).toHaveBeenCalled();
  expect(mocked.formatKnowledgeLayoutWithAI).not.toHaveBeenCalled();
});

it('remembers unsupported rich content so it can reach later articles', async () => {
  inputs('<p>正文</p><table><tr><td>4 mg</td></tr></table>');
  await warmKnowledgeLayoutBatch(1);
  await warmKnowledgeLayoutBatch(1);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(mocked.formatKnowledgeLayoutWithAI).not.toHaveBeenCalled();
});

it('processes the complete batch with at most three simultaneous model requests', async () => {
  inputs(text, 5);
  let active = 0;
  let peak = 0;
  mocked.formatKnowledgeLayoutWithAI.mockImplementation(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active -= 1;
    return { verified: false, blocks: [], reason: 'provider_error' };
  });
  expect((await warmKnowledgeLayoutBatch(5)).failed).toBe(5);
  expect(mocked.formatKnowledgeLayoutWithAI).toHaveBeenCalledTimes(5);
  expect(peak).toBe(3);
  expect(active).toBe(0);
});

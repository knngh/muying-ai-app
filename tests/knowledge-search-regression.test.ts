const originalEnv = { ...process.env };
let searchQAWithRewrite: typeof import('../src/services/knowledge.service').searchQAWithRewrite;

beforeAll(() => {
  // Exercise the bundled search fallback without depending on live AI providers.
  process.env = {
    ...originalEnv,
    AI_SEARCH_REWRITE: 'false',
    AI_VECTOR_RETRIEVAL: 'false',
    AI_KNOWLEDGE_RERANK: 'false',
  };
  jest.isolateModules(() => {
    ({ searchQAWithRewrite } = require('../src/services/knowledge.service'));
  });
});

beforeEach(() => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('External requests are disabled in local search tests'));
});

afterEach(() => {
  try {
    expect(globalThis.fetch).not.toHaveBeenCalled();
  } finally {
    jest.restoreAllMocks();
  }
});

afterAll(() => {
  process.env = originalEnv;
});

describe('knowledge search regressions', () => {
  it('returns symptom-oriented results for baby fever queries', async () => {
    const results = await searchQAWithRewrite('宝宝发烧怎么办', { limit: 5 });

    expect(results.length).toBeGreaterThan(0);
    expect(results.slice(0, 3).some((item) => (
      /发烧|发热|高烧/u.test(item.question)
      || ['common-symptoms', 'vaccine-reaction', 'parenting-newborn', 'parenting-1-3'].includes(item.category)
    ))).toBe(true);
  });

  it('returns pregnancy-stage results for edema queries instead of empty results', async () => {
    const results = await searchQAWithRewrite('孕晚期脚肿怎么办', { limit: 5 });

    expect(results.length).toBeGreaterThan(0);
    expect(results.slice(0, 3).some((item) => (
      /脚肿|浮肿|水肿/u.test(item.question + item.answer)
      || item.category === 'pregnancy-late'
    ))).toBe(true);
  });
});

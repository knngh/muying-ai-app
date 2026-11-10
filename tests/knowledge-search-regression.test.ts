const originalEnv = { ...process.env };
import { buildAuthorityVectorId } from '../src/services/vector.service';
let searchQAWithRewrite: typeof import('../src/services/knowledge.service').searchQAWithRewrite;
let shouldIncludeAuthoritySearchRecord: typeof import('../src/services/knowledge.service').__knowledgeServiceTestUtils.shouldIncludeAuthoritySearchRecord;
let toVectorSupplementResult: typeof import('../src/services/knowledge.service').__knowledgeServiceTestUtils.toVectorSupplementResult;

beforeAll(() => {
  // Exercise the bundled search fallback without depending on live AI providers.
  process.env = {
    ...originalEnv,
    AI_SEARCH_REWRITE: 'false',
    AI_VECTOR_RETRIEVAL: 'false',
    AI_KNOWLEDGE_RERANK: 'false',
  };
  jest.isolateModules(() => {
    const service = require('../src/services/knowledge.service') as typeof import('../src/services/knowledge.service');
    searchQAWithRewrite = service.searchQAWithRewrite;
    shouldIncludeAuthoritySearchRecord = service.__knowledgeServiceTestUtils.shouldIncludeAuthoritySearchRecord;
    toVectorSupplementResult = service.__knowledgeServiceTestUtils.toVectorSupplementResult;
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
  it('rejects an ACOG pregnancy directory from the existing vector corpus by source URL', () => {
    expect(shouldIncludeAuthoritySearchRecord({
      question: 'Labor and Delivery',
      answer: 'Pregnancy and birth resources for your family. '.repeat(30),
      topic: '孕期',
      category: 'pregnancy',
      source: 'ACOG',
      source_org: 'ACOG',
      source_id: 'acog',
      source_url: 'https://www.acog.org/womens-health/pregnancy/labor-and-delivery',
      source_class: 'official',
    } as never)).toBe(false);
  });

  it('maps legacy ACOG vector ids back to source URLs before adding search supplements', () => {
    const sourceUrl = 'https://www.acog.org/womens-health/pregnancy/labor-and-delivery';
    const sourceRecord = {
      question: 'Labor and Delivery', answer: 'Pregnancy and birth resources for your family. '.repeat(30),
      source: 'ACOG', source_org: 'ACOG', source_id: 'acog', source_url: sourceUrl, source_class: 'official',
    };
    expect(toVectorSupplementResult({
      id: buildAuthorityVectorId(sourceUrl), question: 'Labor and Delivery',
      answer: sourceRecord.answer, category: '孕期', source: 'ACOG',
    }, 0, [sourceRecord as never])).toBeNull();
  });

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

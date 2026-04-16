import { searchQAWithRewrite } from '../src/services/knowledge.service';

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

jest.mock('../src/services/typesafe.service', () => ({
  askJevChoices: jest.fn(),
}));
jest.mock('../src/services/tool-review-text.service', () => ({
  callToolReviewText: jest.fn(),
}));

import { buildRuleToolAIReview, generateToolAIReview } from '../src/services/tool-ai-review.service';
import { askJevChoices } from '../src/services/typesafe.service';
import { callToolReviewText } from '../src/services/tool-review-text.service';

beforeEach(() => jest.resetAllMocks());

describe('tool AI review fallback', () => {
  it('summarizes saved records without making a health judgment', () => {
    const result = buildRuleToolAIReview({
      toolId: 'weight',
      records: [
        { date: '2026-09-21', content: '体重 62.4 kg' },
        { date: '2026-09-14', content: '体重 61.9 kg' },
      ],
    });

    expect(result.source).toBe('rules');
    expect(result.summary).toContain('已保存 2 条孕期体重记录');
    expect(result.highlights).toHaveLength(2);
    expect(result.summary).not.toMatch(/正常|异常|诊断|治疗/u);
    expect(result.disclaimer).toContain('不是医疗建议');
  });

  it('keeps only a bounded, non-empty record set', () => {
    const result = buildRuleToolAIReview({
      toolId: 'diary',
      records: [
        { date: '', content: '   今天写了一点记录   ' },
        { date: '2026-09-20', content: '' },
      ],
    });

    expect(result.summary).toContain('已保存 1 条孕育日记记录');
    expect(result.highlights).toEqual(['未标日期 · 今天写了一点记录']);
  });

  it('lets Jev choose the fixed focus before GLM writes Chinese phrasing', async () => {
    (askJevChoices as jest.Mock).mockResolvedValueOnce({
      model: 'jev-1.13.0',
      answers: { focus: { type: 'choice', choice: 'trend', confidence: 0.92, probabilities: { trend: 0.92, completeness: 0.03, handoff: 0.03, follow_up: 0.02 } } },
      usage: { input_tokens: 20, output_tokens: 5 },
    });
    (callToolReviewText as jest.Mock).mockResolvedValueOnce({
      answer: JSON.stringify({ title: '体重记录回顾', summary: '按日期整理了已保存的测量记录。', highlights: ['记录了两次测量'], nextSteps: ['继续保留测量日期'] }),
      route: { provider: 'zhipu', model: 'glm-5.3', route: 'task', label: 'task-glm' },
    });

    const result = await generateToolAIReview({
      toolId: 'weight', stage: '孕 28 周', records: [
        { date: '2026-09-21', content: '体重 62.4 kg' },
        { date: '2026-09-14', content: '体重 61.9 kg' },
      ],
    });

    expect(result).toMatchObject({ source: 'ai', focus: '变化趋势', provider: 'zhipu', model: 'glm-5.3' });
    expect(askJevChoices).toHaveBeenCalledTimes(1);
    expect(callToolReviewText).toHaveBeenCalledWith(expect.any(Array));
  });

  it('falls back to a neutral focus when Jev confidence is low', async () => {
    (askJevChoices as jest.Mock).mockResolvedValueOnce({
      model: 'jev-1.13.0',
      answers: { focus: { type: 'choice', choice: 'trend', confidence: 0.41, probabilities: { trend: 0.41, completeness: 0.3, handoff: 0.2, follow_up: 0.09 } } },
      usage: { input_tokens: 20, output_tokens: 5 },
    });
    (callToolReviewText as jest.Mock).mockResolvedValueOnce({
      answer: JSON.stringify({ title: '记录回顾', summary: '已整理保存的记录。', highlights: [], nextSteps: [] }),
      route: { provider: 'zhipu', model: 'glm-5.3', route: 'task', label: 'task-glm' },
    });

    const result = await generateToolAIReview({
      toolId: 'diary', records: [{ date: '2026-09-21', content: '今天写了一段记录' }],
    });

    expect(result.focus).toBe('记录完整度');
  });

  it('returns a rule summary when either provider fails to supply usable text', async () => {
    (askJevChoices as jest.Mock).mockRejectedValue(new Error('upstream private input'));
    (callToolReviewText as jest.Mock).mockRejectedValue(new Error('upstream private input'));
    const input = { toolId: 'diary' as const, records: [{ date: '2026-09-21', content: '今天散步' }] };
    expect(await generateToolAIReview(input)).toEqual(buildRuleToolAIReview(input));
  });

  it('falls back when the generated body is not JSON', async () => {
    (callToolReviewText as jest.Mock).mockResolvedValue({ answer: 'not JSON', route: { model: 'glm-5.3', provider: 'zhipu' } });
    const input = { toolId: 'weight' as const, records: [{ date: '2026-09-21', content: '体重 62.4 kg' }] };
    expect((await generateToolAIReview(input)).source).toBe('rules');
  });

  it('replaces clinical statements instead of presenting them as generated advice', async () => {
    (callToolReviewText as jest.Mock).mockResolvedValue({
      answer: JSON.stringify({ title: '诊断结果', summary: '体重完全正常', highlights: ['肯定会顺产'], nextSteps: ['服用药物'] }),
      route: { model: 'glm-5.3', provider: 'zhipu' },
    });
    const input = { toolId: 'weight' as const, records: [{ date: '2026-09-21', content: '体重 62.4 kg' }] };
    const result = await generateToolAIReview(input);
    const baseline = buildRuleToolAIReview(input);
    expect(result.summary).toBe(baseline.summary);
    expect(result.nextSteps).toEqual(baseline.nextSteps);
    expect(result.highlights).toEqual(baseline.highlights);
    expect(result.source).toBe('rules');
    expect(result.model).toBeNull();
  });

  it.each([{}, { title: '记录', summary: '记录摘要', highlights: [12], nextSteps: [] }])(
    'does not label malformed structured output as AI text', async body => {
      (callToolReviewText as jest.Mock).mockResolvedValue({
        answer: JSON.stringify(body), route: { model: 'glm-5.3', provider: 'zhipu' },
      });
      const input = { toolId: 'diary' as const, records: [{ date: '2026-09-21', content: '今天散步' }] };
      expect(await generateToolAIReview(input)).toEqual(buildRuleToolAIReview(input));
    },
  );
});

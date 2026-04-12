import { classifyMaternalChildQuestion, hasMaternalChildSignal } from '../src/services/ai-domain.service';

describe('ai-domain service', () => {
  it('recognizes numeric pregnancy week phrasing as maternal-child context', () => {
    expect(hasMaternalChildSignal('我是孕16周，最近早晨容易恶心')).toBe(true);
    expect(hasMaternalChildSignal('我现在孕 24 周，晚上腿有点抽筋')).toBe(true);
    expect(hasMaternalChildSignal('现在是第 12 孕周，饮食上怎么安排')).toBe(true);
  });

  it('keeps numeric pregnancy week questions in scope instead of clarification', () => {
    expect(
      classifyMaternalChildQuestion('我是孕16周，没有腹痛和出血，最近早晨容易恶心，早餐怎么安排更舒服一些？').status,
    ).toBe('in_scope');
  });
});

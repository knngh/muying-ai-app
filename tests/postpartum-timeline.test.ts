import { getPostpartumTimelineTodos } from '../src/utils/postpartum-timeline';
import { parseTimelineKey } from '../src/utils/timeline';

function period(key: string) {
  const parsed = parseTimelineKey(key);
  if (!parsed) {
    throw new Error(`Invalid test key: ${key}`);
  }
  return parsed;
}

describe('postpartum timeline todos', () => {
  it('returns newborn and maternal recovery todos for the first week', () => {
    const todos = getPostpartumTimelineTodos(period('postpartum:w01'));

    expect(todos).toEqual(expect.arrayContaining([
      expect.objectContaining({
        todoKey: 'postpartum:w01:newborn-home-visit',
        title: '确认新生儿访视',
        type: 'checkup',
      }),
      expect.objectContaining({
        todoKey: 'postpartum:w01:feeding-output-log',
        type: 'feeding',
      }),
      expect.objectContaining({
        todoKey: 'postpartum:w01:postpartum-recovery-log',
        type: 'care',
      }),
    ]));
  });

  it('returns six-month checkup and solid food todos near 6 months', () => {
    const todos = getPostpartumTimelineTodos(period('postpartum:w26'));

    expect(todos).toEqual(expect.arrayContaining([
      expect.objectContaining({
        todoKey: 'postpartum:w26:six-month-checkup',
        title: '完成 6 月龄健康检查',
      }),
      expect.objectContaining({
        todoKey: 'postpartum:w26:solid-food-start',
        title: '建立辅食记录',
      }),
    ]));
  });

  it('returns three-year checkup todos near week 156', () => {
    const todos = getPostpartumTimelineTodos(period('postpartum:w156'));

    expect(todos).toEqual([
      expect.objectContaining({
        todoKey: 'postpartum:w156:three-year-checkup',
        title: '完成 3 岁健康检查',
      }),
    ]);
  });

  it('does not return postpartum todos for pregnancy timeline periods', () => {
    expect(getPostpartumTimelineTodos(period('pregnancy:w24'))).toEqual([]);
  });
});

import { mapWithConcurrency } from '../src/utils/concurrency';

describe('mapWithConcurrency', () => {
  it('preserves result order while limiting active tasks', async () => {
    let active = 0;
    let maxActive = 0;

    const result = await mapWithConcurrency([4, 1, 3, 2], 2, async (value, index) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, value * 5));
      active -= 1;
      return `${index}:${value}`;
    });

    expect(result).toEqual(['0:4', '1:1', '2:3', '3:2']);
    expect(maxActive).toBe(2);
  });

  it('falls back to one worker for invalid concurrency', async () => {
    let active = 0;
    let maxActive = 0;

    await mapWithConcurrency([1, 2], 0, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });

    expect(maxActive).toBe(1);
  });
});

import { updateProfileBody } from '../src/schemas/auth.schema';
import { resolveLifecycleStage } from '../src/utils/pregnancy';

describe('pregnancy lifecycle guards', () => {
  it('prefers due date when profile data is conflicted', () => {
    const stage = resolveLifecycleStage(3, new Date('2026-12-05T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z'));
    expect(stage).toBe('pregnant');
  });

  it('treats baby birthday as postpartum when due date is absent', () => {
    const stage = resolveLifecycleStage(2, null, new Date('2026-01-01T00:00:00.000Z'));
    expect(stage).toBe('postpartum');
  });

  it('rejects setting due date and baby birthday together', () => {
    expect(() => updateProfileBody.parse({
      dueDate: '2026-12-05',
      babyBirthday: '2026-01-01',
    })).toThrow('预产期和宝宝生日不能同时设置');
  });
});

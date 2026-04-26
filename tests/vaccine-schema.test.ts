import { getVaccinesQuery } from '../src/schemas/vaccine.schema';

describe('vaccine schemas', () => {
  it('validates vaccine list filters before controller number parsing', () => {
    expect(getVaccinesQuery.parse({ monthAge: '0', category: 'routine' })).toEqual({
      monthAge: 0,
      category: 'routine',
    });
    expect(getVaccinesQuery.parse({ monthAge: '12' })).toEqual({ monthAge: 12 });
    expect(getVaccinesQuery.safeParse({ monthAge: '-1' }).success).toBe(false);
    expect(getVaccinesQuery.safeParse({ monthAge: 'abc' }).success).toBe(false);
    expect(getVaccinesQuery.safeParse({ category: 'a'.repeat(51) }).success).toBe(false);
  });
});

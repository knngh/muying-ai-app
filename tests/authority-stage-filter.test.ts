import {
  matchesAuthorityStageFilters,
  normalizeAuthorityStageFilters,
} from '../src/utils/authority-stage-filter';

describe('authority stage filter', () => {
  it('supports comma-separated multi-stage filters', () => {
    expect(
      normalizeAuthorityStageFilters('postpartum,newborn,0-6-months'),
    ).toEqual(['postpartum', 'newborn', '0-6-months']);
  });

  it('ignores unknown stages and duplicates', () => {
    expect(
      normalizeAuthorityStageFilters(['newborn,unknown', 'newborn', 'postpartum']),
    ).toEqual(['newborn', 'postpartum']);
  });

  it('matches when article belongs to any requested authority stage', () => {
    expect(
      matchesAuthorityStageFilters(['newborn', '0-6-months'], 'postpartum,newborn'),
    ).toBe(true);

    expect(
      matchesAuthorityStageFilters(['1-3-years'], 'postpartum,newborn'),
    ).toBe(false);
  });
});

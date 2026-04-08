import { shouldFilterAuthoritySourceUrl } from '../src/utils/authority-source-url';

describe('authority source url filtering', () => {
  test('filters China CDC home and section navigation pages', () => {
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'chinacdc-immunization',
      source_url: 'https://www.chinacdc.cn/',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'chinacdc-immunization',
      source_url: 'https://www.chinacdc.cn/jkkp/mygh/ztrxc/',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'chinacdc-immunization',
      source_url: 'https://www.chinacdc.cn/jkkp/mygh/ztrxc/202504/t20250411_305918.html',
    })).toBe(false);
  });

  test('filters common English source landing pages but keeps article pages', () => {
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'cdc',
      source_url: 'https://www.cdc.gov/parents/',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'aap',
      source_url: 'https://www.healthychildren.org/English/ages-stages/',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'acog',
      source_url: 'https://www.acog.org/womens-health/',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'nhs',
      source_url: 'https://www.nhs.uk/pregnancy/',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'cdc',
      source_url: 'https://www.cdc.gov/pregnancy/meds/treatingfortwo/index.html',
    })).toBe(false);
  });
});

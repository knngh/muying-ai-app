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

  test('filters DXY category pages but keeps concrete article pages', () => {
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'dxy-maternal',
      source_url: 'https://m.dxy.com/articles/24826',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'dxy-maternal',
      source_url: 'https://dxy.com/article/26760',
    })).toBe(false);
  });

  test('keeps Youlai pregnancy guide pages but filters unrelated special pages', () => {
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'youlai-pregnancy-guide',
      source_url: 'https://m.youlai.cn/special/advisor/vezz0BpCQ3.html',
    })).toBe(false);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'youlai-pregnancy-guide',
      source_url: 'https://m.youlai.cn/special/pregnancy/PyevheSdNw.html',
    })).toBe(true);
  });

  test('filters FamilyDoctor category pages but keeps concrete article pages', () => {
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'familydoctor-maternal',
      source_url: 'https://www.familydoctor.com.cn/yc/',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'familydoctor-maternal',
      source_url: 'https://www.familydoctor.com.cn/baby/a/202604/3948358.html',
    })).toBe(false);
  });
});

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
      source_id: 'acog',
      source_url: 'https://www.acog.org/topics/prenatal-care',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'nhs',
      source_url: 'https://www.nhs.uk/pregnancy/',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'cdc',
      source_url: 'https://www.cdc.gov/pregnancy/meds/treatingfortwo/index.html',
    })).toBe(false);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'acog',
      source_url: 'https://www.acog.org/clinical/clinical-guidance/practice-advisory/articles/2024/04/screening-for-syphilis-in-pregnancy',
    })).toBe(false);
  });

  test('filters NHC topic landing pages but keeps topic article pages', () => {
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'nhc-fys',
      source_url: 'https://www.nhc.gov.cn/jnr/jrjjk/csqxr_lmtt.shtml',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'nhc-fys',
      source_url: 'https://www.nhc.gov.cn/fys/mrwy/mrwy_index.shtml',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'nhc-fys',
      source_url: 'https://www.nhc.gov.cn/fys/mrkpxc/201505/315c326a1db54022a93b063eb543178b.shtml',
    })).toBe(false);
  });

  test('filters gov.cn support policy pages but keeps health guidance pages', () => {
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'govcn-jiedu-muying',
      source_org: '中国政府网政策解读',
      question: '国家育儿补贴方案六大热点问答',
      source_url: 'https://www.gov.cn/zhengce/202507/content_7034137.htm',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'govcn-jiedu-muying',
      source_org: '中国政府网政策解读',
      question: '《婴幼儿早期发展服务指南（试行）》文件解读',
      source_url: 'https://www.gov.cn/zhengce/202502/content_7002879.htm',
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

  test('filters Dayi search and non-article pages but keeps maternal-child detail pages', () => {
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'dayi-maternal-child',
      source_url: 'https://www.dayi.org.cn/search?keyword=%E5%AD%95%E5%A6%87',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'dayi-maternal-child',
      source_url: 'https://www.dayi.org.cn/doctor/1119229.html',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'dayi-maternal-child',
      source_url: 'https://www.dayi.org.cn/qa/153633.html',
    })).toBe(false);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'dayi-maternal-child',
      source_url: 'https://www.dayi.org.cn/symptom/1153160.html',
    })).toBe(false);
  });

  test('filters Kepuchina search/special/video pages but keeps articleinfo text pages', () => {
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'kepuchina-maternal-child',
      source_url: 'https://www.kepuchina.cn/search/index?search=%E6%AF%8D%E4%B9%B3',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'kepuchina-maternal-child',
      source_url: 'https://www.kepuchina.cn/special/specialinfo?id=AR202508011646548120',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'kepuchina-maternal-child',
      source_url: 'https://www.kepuchina.cn/article/articleinfo?business_type=100&classify=2&ar_id=558465',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'kepuchina-maternal-child',
      source_url: 'https://www.kepuchina.cn/article/articleinfo?business_type=100&classify=0&ar_id=558464',
    })).toBe(false);
  });

  test('filters Yilianmeiti category/media pages but keeps concrete article pages', () => {
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'yilianmeiti-maternal-child',
      source_url: 'https://www.yilianmeiti.com/3/',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'yilianmeiti-maternal-child',
      source_url: 'https://www.yilianmeiti.com/video/d/199003.html',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'yilianmeiti-maternal-child',
      source_url: 'https://www.yilianmeiti.com/article/2528524.html',
    })).toBe(false);
  });

  test('filters Haodf search/case pages but keeps doctor-authored article pages', () => {
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'haodf-maternal-child',
      source_url: 'https://www.haodf.com/s?wd=%E6%AF%8D%E4%B9%B3',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'haodf-maternal-child',
      source_url: 'https://www.haodf.com/bingcheng/8890560235.html',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'haodf-maternal-child',
      source_url: 'https://www.haodf.com/neirong/wenzhang/9394363019.html',
    })).toBe(false);
  });

  test('filters CMA kepu index/proxy pages but keeps concrete article pages', () => {
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'cma-kepu-maternal-child',
      source_url: 'https://www.cma.org.cn/col/col4584/index.html',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'cma-kepu-maternal-child',
      source_url: 'https://www.cma.org.cn/module/web/jpage/dataproxy.jsp?page=1&webid=1&columnid=4584',
    })).toBe(true);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'cma-kepu-maternal-child',
      source_url: 'https://www.cma.org.cn/art/2025/10/29/art_4584_60353.html',
    })).toBe(false);
  });

  test('filters newly added Chinese source landing pages but keeps detail pages', () => {
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'ncwch-maternal-child-health',
      source_url: 'https://www.ncwchnhc.org.cn/content/redirect?id=7390950695819546624',
    })).toBe(true);
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'ncwch-maternal-child-health',
      source_url: 'https://www.ncwchnhc.org.cn/content/content.html?id=7313481602116358144',
    })).toBe(false);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'mchscn-monitoring',
      source_url: 'https://www.mchscn.cn/MaternalSafetyMonitoring-26.html',
    })).toBe(true);
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'mchscn-monitoring',
      source_url: 'https://www.mchscn.cn/MaternalSafetyMonitoring-26/682.html',
    })).toBe(false);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'cnsoc-dietary-guidelines',
      source_url: 'http://dg.cnsoc.org/index.html',
    })).toBe(true);
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'cnsoc-dietary-guidelines',
      source_url: 'http://dg.cnsoc.org/article/04/gc5cUak3RhSGheqSaRljnA.html',
    })).toBe(false);

    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'chinanutri-maternal-child',
      source_url: 'https://www.chinanutri.cn/xwzx_238/gzdt/202603/t20260325_315897.html',
    })).toBe(true);
    expect(shouldFilterAuthoritySourceUrl({
      source_id: 'chinanutri-maternal-child',
      source_url: 'https://www.chinanutri.cn/xwzx_238/xyxw/202603/t20260316_315502.html',
    })).toBe(false);
  });
});

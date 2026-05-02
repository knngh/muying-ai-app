import { getAuthoritySourceConfig, listEnabledAuthoritySources } from '../src/config/authority-sources';
import { __authoritySyncTestUtils, normalizeAuthorityDocument, shouldExportAuthoritySnapshotDocument } from '../src/services/authority-sync.service';
import { detectAudience, detectTopic, extractTitle, shouldPublishDocument } from '../src/services/authority-adapters/base.adapter';
import { inferAuthorityStages } from '../src/utils/authority-stage';

describe('authority index discovery', () => {
  test('keeps only high-confidence third-party Chinese sources enabled for automatic runs', () => {
    const enabledIds = new Set(listEnabledAuthoritySources().map((source) => source.id));

    expect(enabledIds).toContain('youlai-pregnancy-guide');
    expect(enabledIds).toContain('dayi-maternal-child');
    expect(enabledIds).toContain('kepuchina-maternal-child');
    expect(enabledIds).toContain('haodf-maternal-child');
    expect(enabledIds).not.toContain('chunyu-maternal');
    expect(enabledIds).not.toContain('familydoctor-maternal');
    expect(enabledIds).not.toContain('yilianmeiti-maternal-child');
  });

  test('resolves China CDC relative content links against the current entry page and skips index links', () => {
    const source = getAuthoritySourceConfig('chinacdc-immunization');
    expect(source).toBeDefined();

    const html = `
      <ul class="xw_list">
        <li><a href="./202504/t20250411_305918.html" target="_blank">全国儿童预防接种日—预防接种宣传核心信息（2025年版）<span>2025-04-10</span></a></li>
        <li><a href="../../../">首页</a></li>
        <li><a href="./">主题日宣传</a></li>
      </ul>
    `;

    const links = __authoritySyncTestUtils.extractIndexLinks(html, source!, source!.entryUrls[0]!);

    expect(links).toContain('https://www.chinacdc.cn/jkkp/mygh/ztrxc/202504/t20250411_305918.html');
    expect(links).not.toContain('https://www.chinacdc.cn/');
    expect(links).not.toContain('https://www.chinacdc.cn/jkkp/mygh/ztrxc/');
  });

  test('extracts NDCPA content links from inline script payloads', () => {
    const source = getAuthoritySourceConfig('ndcpa-immunization');
    expect(source).toBeDefined();

    const html = `
      <script>
        var itemObj = [{
          "aT":"关于调整国家免疫规划专家咨询委员会委员的通知",
          "aU":"{\\"common\\":\\"/jbkzzx/c100014/common/content/content_1961007702056800256.html\\"}"
        }];
      </script>
    `;

    const links = __authoritySyncTestUtils.extractIndexLinks(html, source!, source!.entryUrls[0]!);

    expect(links).toContain('https://www.ndcpa.gov.cn/jbkzzx/c100014/common/content/content_1961007702056800256.html');
  });

  test('rejects NDCPA list pages even when they contain maternal-child keywords', () => {
    const source = getAuthoritySourceConfig('ndcpa-public-health');
    expect(source).toBeDefined();

    const matched = __authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.ndcpa.gov.cn/jbkzzx/c100014/common/list.html',
      source!,
      '儿童疫苗接种',
    );

    expect(matched).toBe(false);
  });

  test('prioritizes Mayo Chinese maternal-child article URLs and excludes department pages from large sitemap files', () => {
    const source = getAuthoritySourceConfig('mayo-clinic-zh');
    expect(source).toBeDefined();

    const xml = `
      <urlset>
        <url><loc>https://www.mayoclinic.org/zh-hans/departments-centers/childrens-center</loc></url>
        <url><loc>https://www.mayoclinic.org/zh-hans/departments-centers/childrens-center/overview/specialty-groups/newborn-intensive-care-unit-follow-up-clinic</loc></url>
        <url><loc>https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/in-depth/baby-poop/art-20043980</loc></url>
        <url><loc>https://www.mayoclinic.org/zh-hans/diseases-conditions/childhood-asthma/symptoms-causes/syc-20351507</loc></url>
      </urlset>
    `;

    const links = __authoritySyncTestUtils.extractSitemapUrls(xml, source!);

    expect(links[0]).toBe('https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/in-depth/baby-poop/art-20043980');
    expect(links[1]).toBe('https://www.mayoclinic.org/zh-hans/diseases-conditions/childhood-asthma/symptoms-causes/syc-20351507');
    expect(links).not.toContain('https://www.mayoclinic.org/zh-hans/departments-centers/childrens-center/overview/specialty-groups/newborn-intensive-care-unit-follow-up-clinic');
  });

  test('does not let generic Mayo vaccine timeline pages crowd out maternal-child articles', () => {
    const source = getAuthoritySourceConfig('mayo-clinic-zh');
    expect(source).toBeDefined();

    expect(__authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.mayoclinic.org/zh-hans/diseases-conditions/history-disease-outbreaks-vaccine-timeline',
      source!,
    )).toBe(false);

    expect(__authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.mayoclinic.org/zh-hans/patient-visitor-guide/minnesota/campus-buildings-maps/mayo-eugenio-litta-childrens-hospital',
      source!,
    )).toBe(false);

    expect(__authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/in-depth/baby-poop/art-20043980',
      source!,
    )).toBe(true);
  });

  test('keeps MSD Chinese nested sitemap URLs before article matching is applied', () => {
    const source = getAuthoritySourceConfig('msd-manuals-cn');
    expect(source).toBeDefined();

    const xml = `
      <sitemapindex>
        <sitemap><loc>https://www.msdmanuals.cn/sitemaps/professional-topic.xml.gz</loc></sitemap>
        <sitemap><loc>https://www.msdmanuals.cn/sitemaps/home-generic-pages.xml</loc></sitemap>
        <sitemap><loc>https://www.msdmanuals.cn/sitemaps/home-topic.xml.gz</loc></sitemap>
      </sitemapindex>
    `;

    const locUrls = __authoritySyncTestUtils.extractSitemapLocUrls(xml);
    const nestedSitemaps = __authoritySyncTestUtils.filterNestedSitemapCandidates(locUrls, source!);

    expect(nestedSitemaps).toEqual([
      'https://www.msdmanuals.cn/sitemaps/home-topic.xml.gz',
      'https://www.msdmanuals.cn/sitemaps/home-generic-pages.xml',
    ]);
  });

  test('matches MSD Chinese child health pages without accepting unrelated immune-system articles', () => {
    const source = getAuthoritySourceConfig('msd-manuals-cn');
    expect(source).toBeDefined();

    expect(__authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.msdmanuals.cn/home/blood-disorders/anemia/autoimmune-hemolytic-anemia',
      source!,
    )).toBe(false);

    expect(__authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.msdmanuals.cn/home/children-s-health-issues/symptoms-in-infants-and-children/fever-in-infants-and-children',
      source!,
    )).toBe(true);
  });

  test('prioritizes lower-sensitivity MSD child symptom pages before severe infection pages', () => {
    const source = getAuthoritySourceConfig('msd-manuals-cn');
    expect(source).toBeDefined();

    const links = __authoritySyncTestUtils.prioritizeAuthorityUrls([
      'https://www.msdmanuals.cn/home/children-s-health-issues/bacterial-infections-in-infants-and-children/meningitis-in-children',
      'https://www.msdmanuals.cn/home/children-s-health-issues/symptoms-in-infants-and-children/fever-in-infants-and-children',
    ], source!);

    expect(links[0]).toBe('https://www.msdmanuals.cn/home/children-s-health-issues/symptoms-in-infants-and-children/fever-in-infants-and-children');
  });

  test('extracts pagination links from category pages without following other channel tabs', () => {
    const source = getAuthoritySourceConfig('chunyu-maternal');
    expect(source).toBeDefined();

    const html = `
      <nav>
        <a href="/m/health_news_home/?channel_id=21">生活</a>
        <a href="/m/health_news_home/?channel_id=6">母婴</a>
      </nav>
      <section class="health-info-wrap">
        <a href="/m/article/231621/">试试这样做？减少牛奶蛋白过敏，帮助宝宝长期受益</a>
      </section>
      <div class="pagebar">
        <a class="prev disabled" href="javascript:void(0)">上一页</a>
        <a class="page" href="javascript:void(0)">1</a>
        <a class="next" href="/m/health_news_home/?channel_id=6&amp;page=2">下一页</a>
      </div>
    `;

    const links = __authoritySyncTestUtils.extractPaginationLinks(html, source!, source!.entryUrls[0]!);

    expect(links).toContain('https://m.chunyuyisheng.com/m/health_news_home/?channel_id=6&page=2');
    expect(links).not.toContain('https://m.chunyuyisheng.com/m/health_news_home/?channel_id=21');
    expect(links).not.toContain('https://m.chunyuyisheng.com/m/health_news_home/?channel_id=6');
  });

  test('matches Chunyu article URLs even when anchor text is appended for keyword filtering', () => {
    const source = getAuthoritySourceConfig('chunyu-maternal');
    expect(source).toBeDefined();

    const matched = __authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://m.chunyuyisheng.com/m/article/231621/',
      source!,
      '试试这样做？减少牛奶蛋白过敏，帮助宝宝长期受益',
    );

    expect(matched).toBe(true);
  });

  test('does not treat Chunyu numeric article detail pages as index pages', () => {
    expect(
      __authoritySyncTestUtils.isIndexLikeAuthorityUrl('https://m.chunyuyisheng.com/m/article/231621/'),
    ).toBe(false);
  });

  test('extracts DXY maternal article URLs from embedded JSON list payloads', () => {
    const source = getAuthoritySourceConfig('dxy-maternal');
    expect(source).toBeDefined();

    const html = `
      <script>
        window.$$data={
          "type":"24826",
          "list":{
            "items":[
              {
                "id":26760,
                "title":"6～24 个月宝宝辅食怎么加？看这一篇就够了",
                "content_brief":"详细解答不同月龄宝宝何时吃、怎么吃、吃多少。"
              },
              {
                "id":9353,
                "title":"脚上长老茧了怎么办？给你 6 个靠谱方法",
                "content_brief":"和母婴无关的普通健康文章。"
              }
            ]
          }
        }
      </script>
    `;

    const links = __authoritySyncTestUtils.extractIndexLinks(html, source!, source!.entryUrls[0]!);

    expect(links).toContain('https://dxy.com/article/26760');
    expect(links).not.toContain('https://dxy.com/article/9353');
  });

  test('extracts Youlai pregnancy guide previous and next week pages as pagination links', () => {
    const source = getAuthoritySourceConfig('youlai-pregnancy-guide');
    expect(source).toBeDefined();

    const html = `
      <div class="nav-one-week">
        <dl class="list-flex-space">
          <dd class="before-week">
            <a href="/special/advisor/dOP09kv7LD.html" class="week-link"><span>19</span>周</a>
          </dd>
          <dd class="after-week">
            <a href="/special/advisor/Y1GM7t6T1g.html" class="week-link"><span>21</span>周</a>
          </dd>
        </dl>
      </div>
    `;

    const links = __authoritySyncTestUtils.extractPaginationLinks(html, source!, source!.entryUrls[0]!);

    expect(links).toContain('https://m.youlai.cn/special/advisor/dOP09kv7LD.html');
    expect(links).toContain('https://m.youlai.cn/special/advisor/Y1GM7t6T1g.html');
  });

  test('matches Youlai pregnancy guide pages by special advisor path', () => {
    const source = getAuthoritySourceConfig('youlai-pregnancy-guide');
    expect(source).toBeDefined();

    const matched = __authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://m.youlai.cn/special/advisor/vezz0BpCQ3.html',
      source!,
      '怀孕第20周',
    );

    expect(matched).toBe(true);
  });

  test('extracts Dayi maternal-child detail URLs from search pages and skips doctors', () => {
    const source = getAuthoritySourceConfig('dayi-maternal-child');
    expect(source).toBeDefined();

    const html = `
      <div class="public-node">
        <a href="/disease/1160577.html"><em>孕妇</em>贫血</a>
        <a href="/symptom/1142681.html"><em>孕妇</em>腿抽筋</a>
        <a href="/qa/153633.html"><em>孕妇</em>脚痒怎么办</a>
        <a href="/doctor/1119229.html">李若瑜 主任医师</a>
        <a href="/disease/1150927.html">高血压</a>
      </div>
    `;

    const links = __authoritySyncTestUtils.extractIndexLinks(html, source!, source!.entryUrls[0]!);

    expect(links).toContain('https://www.dayi.org.cn/disease/1160577.html');
    expect(links).toContain('https://www.dayi.org.cn/symptom/1142681.html');
    expect(links).toContain('https://www.dayi.org.cn/qa/153633.html');
    expect(links).not.toContain('https://www.dayi.org.cn/doctor/1119229.html');
    expect(links).not.toContain('https://www.dayi.org.cn/disease/1150927.html');
  });

  test('matches Dayi detail pages by maternal-child title keywords', () => {
    const source = getAuthoritySourceConfig('dayi-maternal-child');
    expect(source).toBeDefined();

    const matched = __authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.dayi.org.cn/qa/153633.html',
      source!,
      '孕妇脚痒怎么办',
    );
    const unrelated = __authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.dayi.org.cn/disease/1150927.html',
      source!,
      '高血压',
    );

    expect(matched).toBe(true);
    expect(unrelated).toBe(false);
  });

  test('extracts Kepuchina maternal-child article URLs from search pages and skips specials', () => {
    const source = getAuthoritySourceConfig('kepuchina-maternal-child');
    expect(source).toBeDefined();

    const html = `
      <div class="sl_item clearfix">
        <a href="https://www.kepuchina.cn/article/articleinfo?business_type=100&classify=0&ar_id=623325">母乳，给孩子最好的礼物</a>
        <a href="https://www.kepuchina.cn/article/articleinfo?business_type=100&classify=0&ar_id=558464">新生儿护理须知！</a>
        <a href="https://www.kepuchina.cn/special/specialinfo?id=AR202508011646548120">世界母乳喂养周专题</a>
        <a href="https://www.kepuchina.cn/article/articleinfo?business_type=100&classify=2&ar_id=558465">新生儿护理视频</a>
      </div>
    `;

    const links = __authoritySyncTestUtils.extractIndexLinks(html, source!, source!.entryUrls[0]!);

    expect(links).toContain('https://www.kepuchina.cn/article/articleinfo?business_type=100&classify=0&ar_id=623325');
    expect(links).toContain('https://www.kepuchina.cn/article/articleinfo?business_type=100&classify=0&ar_id=558464');
    expect(links).not.toContain('https://www.kepuchina.cn/special/specialinfo?id=AR202508011646548120');
    expect(links).not.toContain('https://www.kepuchina.cn/article/articleinfo?business_type=100&classify=2&ar_id=558465');
  });

  test('matches Kepuchina articleinfo pages by maternal-child title keywords', () => {
    const source = getAuthoritySourceConfig('kepuchina-maternal-child');
    expect(source).toBeDefined();

    const matched = __authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.kepuchina.cn/article/articleinfo?business_type=100&classify=0&ar_id=623325',
      source!,
      '母乳，给孩子最好的礼物',
    );
    const unrelated = __authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.kepuchina.cn/article/articleinfo?business_type=100&classify=0&ar_id=500001',
      source!,
      '高血压用药知识',
    );

    expect(matched).toBe(true);
    expect(unrelated).toBe(false);
  });

  test('extracts CMA maternal-child articles from embedded datastore links', () => {
    const source = getAuthoritySourceConfig('cma-kepu-maternal-child');
    expect(source).toBeDefined();

    const html = `
      <script type="text/xml"><datastore>
        <record><![CDATA[
          <li><a href="/art/2025/10/29/art_4584_60353.html">为什么新生儿会出现生理性黄疸？需要治疗吗？</a></li>
        ]]></record>
        <record><![CDATA[
          <li><a href="/art/2025/10/30/art_4584_60366.html">双胎妊娠的孕妇更容易得妊娠期高血压，怎么预防？</a></li>
        ]]></record>
        <record><![CDATA[
          <li><a href="/art/2025/10/28/art_4584_60345.html">尿中有泡沫是肾出了问题吗？不一定……</a></li>
        ]]></record>
      </datastore></script>
    `;

    const links = __authoritySyncTestUtils.extractIndexLinks(html, source!, source!.entryUrls[0]!);

    expect(links).toContain('https://www.cma.org.cn/art/2025/10/29/art_4584_60353.html');
    expect(links).toContain('https://www.cma.org.cn/art/2025/10/30/art_4584_60366.html');
    expect(links).not.toContain('https://www.cma.org.cn/art/2025/10/28/art_4584_60345.html');
  });

  test('matches CMA kepu article URLs by maternal-child title keywords', () => {
    const source = getAuthoritySourceConfig('cma-kepu-maternal-child');
    expect(source).toBeDefined();

    const matched = __authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.cma.org.cn/art/2025/10/29/art_4584_60353.html',
      source!,
      '为什么新生儿会出现生理性黄疸？需要治疗吗？',
    );
    const unrelated = __authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.cma.org.cn/art/2025/10/28/art_4584_60345.html',
      source!,
      '尿中有泡沫是肾出了问题吗？不一定……',
    );

    expect(matched).toBe(true);
    expect(unrelated).toBe(false);
  });

  test('follows CMA datastore pagination without treating proxy pages as articles', () => {
    const source = getAuthoritySourceConfig('cma-kepu-maternal-child');
    expect(source).toBeDefined();

    const html = `
      <nextgroup><![CDATA[
        <a href="/module/web/jpage/dataproxy.jsp?page=1&amp;webid=1&amp;path=/&amp;columnid=4584&amp;unitid=325&amp;permissiontype=0"></a>
      ]]></nextgroup>
    `;

    const links = __authoritySyncTestUtils.extractPaginationLinks(html, source!, source!.entryUrls[0]!);

    expect(links).toContain('https://www.cma.org.cn/module/web/jpage/dataproxy.jsp?page=1&webid=1&path=/&columnid=4584&unitid=325&permissiontype=0');
    expect(__authoritySyncTestUtils.isAuthorityUrlMatched(links[0]!, source!)).toBe(false);

    const nextLinks = __authoritySyncTestUtils.extractPaginationLinks(
      '<nextgroup><![CDATA[<a href="./dataproxy.jsp?page=2&path=/&columnid=4584&unitid=325&webname=x"></a>]]></nextgroup>',
      source!,
      'https://www.cma.org.cn/module/web/jpage/dataproxy.jsp?page=1&webid=1&path=/&columnid=4584&unitid=325&permissiontype=0',
    );
    expect(nextLinks[0]).toContain('/module/web/jpage/dataproxy.jsp?page=2');
    expect(nextLinks[0]).toContain('webid=1');
    expect(nextLinks[0]).toContain('permissiontype=0');
  });

  test('extracts FamilyDoctor maternal article URLs from category pages', () => {
    const source = getAuthoritySourceConfig('familydoctor-maternal');
    expect(source).toBeDefined();

    const html = `
      <div class="textTitle">
        <h4>
          <span><a href="https://www.familydoctor.com.cn/baby/baby/jbhl/" target="_blank">[疾病护理]</a></span>
          <a href="https://www.familydoctor.com.cn/baby/a/202604/3948358.html" target="_blank">当孩子出现发烧呕吐肚子疼，父母这样应对更有效</a>
        </h4>
      </div>
      <div class="textTitle">
        <h4>
          <a href="https://yyk.familydoctor.com.cn/21574/" target="_blank">太原儿科医院</a>
        </h4>
      </div>
    `;

    const links = __authoritySyncTestUtils.extractIndexLinks(html, source!, source!.entryUrls[1]!);

    expect(links).toContain('https://www.familydoctor.com.cn/baby/a/202604/3948358.html');
    expect(links).not.toContain('https://yyk.familydoctor.com.cn/21574/');
  });

  test('matches FamilyDoctor maternal article pages by article path and topic keywords', () => {
    const source = getAuthoritySourceConfig('familydoctor-maternal');
    expect(source).toBeDefined();

    const matched = __authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.familydoctor.com.cn/baby/a/202604/3948358.html',
      source!,
      '当孩子出现发烧呕吐肚子疼，父母这样应对更有效',
    );

    expect(matched).toBe(true);
  });

  test('extracts Yilianmeiti maternal-child article URLs from category pages and skips media/hospital links', () => {
    const source = getAuthoritySourceConfig('yilianmeiti-maternal-child');
    expect(source).toBeDefined();

    const html = `
      <div class="article-box">
        <a href="https://www.yilianmeiti.com/article/2934661.html">哺乳期可以喝酒吗？酒精对宝宝的影响要知道</a>
        <a href="https://www.yilianmeiti.com/article/2934874.html">孕早期必看！前三个月这些事千万不能做</a>
        <a href="https://www.yilianmeiti.com/article/2933000.html">更年期阴道干涩怎么改善？这些方法要知道</a>
        <a href="https://www.yilianmeiti.com/video/d/199003.html">外阴白斑癌变风险大揭秘</a>
        <a href="https://zyy.yilianmeiti.com/19067/">乌鲁木齐儿童医院</a>
      </div>
    `;

    const links = __authoritySyncTestUtils.extractIndexLinks(html, source!, source!.entryUrls[0]!);

    expect(links).toContain('https://www.yilianmeiti.com/article/2934661.html');
    expect(links).toContain('https://www.yilianmeiti.com/article/2934874.html');
    expect(links).not.toContain('https://www.yilianmeiti.com/article/2933000.html');
    expect(links).not.toContain('https://www.yilianmeiti.com/video/d/199003.html');
    expect(links).not.toContain('https://zyy.yilianmeiti.com/19067/');
  });

  test('matches Yilianmeiti article pages by article path and maternal-child keywords', () => {
    const source = getAuthoritySourceConfig('yilianmeiti-maternal-child');
    expect(source).toBeDefined();

    const matched = __authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.yilianmeiti.com/article/2528524.html',
      source!,
      '孩子从昨天晚上发烧了',
    );
    const unrelated = __authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.yilianmeiti.com/article/2933000.html',
      source!,
      '更年期阴道干涩怎么改善？这些方法要知道',
    );

    expect(matched).toBe(true);
    expect(unrelated).toBe(false);
  });

  test('rejects Chinese source section pages during URL matching', () => {
    const mchscn = getAuthoritySourceConfig('mchscn-monitoring');
    const cnsoc = getAuthoritySourceConfig('cnsoc-dietary-guidelines');
    const chinanutri = getAuthoritySourceConfig('chinanutri-maternal-child');
    expect(mchscn).toBeDefined();
    expect(cnsoc).toBeDefined();
    expect(chinanutri).toBeDefined();

    expect(__authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.mchscn.cn/MaternalSafetyMonitoring-26.html',
      mchscn!,
      '孕产妇安全监测',
    )).toBe(false);
    expect(__authoritySyncTestUtils.isAuthorityUrlMatched(
      'http://dg.cnsoc.org/index.html',
      cnsoc!,
      '中国居民膳食指南',
    )).toBe(false);
    expect(__authoritySyncTestUtils.isAuthorityUrlMatched(
      'https://www.chinanutri.cn/xwzx_238/gzdt/202603/t20260325_315897.html',
      chinanutri!,
      '营养所工会举办妇女节活动',
    )).toBe(false);
  });

  test('normalizes Youlai pregnancy guide content into authority document text', () => {
    const source = getAuthoritySourceConfig('youlai-pregnancy-guide');
    expect(source).toBeDefined();

    const raw = {
      sourceId: source!.id,
      url: 'https://m.youlai.cn/special/advisor/vezz0BpCQ3.html',
      httpStatus: 200,
      contentType: 'text/html; charset=utf-8',
      contentHash: 'test',
      fetchedAt: '2026-04-09T00:00:00.000Z',
      rawBody: `
        <h2 class="h1-title">孕期全指导</h2>
        <div class="curr-week list-flex-in">
          <h4>怀孕第<span class="select-curr-week">20</span>周</h4>
        </div>
        <div id="yyContent" class="yy-content">
          <div id="yd1" class="con-slide">
            <div class="yy-con-title">胎儿发育</div>
            <div class="yy-con-list">
              <div class="yy-con-list-title list-flex-top"><i></i><h4 class="list-bd">图解胎儿发育</h4></div>
              <div class="yy-con-text">
                <p>此时，胎儿大小如同西柚一般，感觉器官进入成长的关键时期，能够对外界的光线和声音产生更敏感的反应。随着神经系统和消化系统进一步完善，胎儿每天都会进行吞咽、活动和休息等节律变化，孕妈妈通常也能更加稳定地感受到胎动。</p>
              </div>
            </div>
          </div>
          <div id="yd3" class="con-slide">
            <div class="yy-con-title">产检提示</div>
            <div class="yy-con-list">
              <div class="yy-con-list-title list-flex-top"><i></i><h4 class="list-bd">提示信息</h4></div>
              <div class="yy-con-text">
                <p>怀孕20周，这周将进行第3次产检，其中最重要的项目是B超排畸检查。通过系统超声检查，医生会观察胎儿颅脑、脊柱、心脏、四肢及腹部器官发育情况，同时结合孕妈妈宫高、腹围、血压和体重变化综合判断孕期进展是否平稳。</p>
              </div>
            </div>
          </div>
          <div id="yd4" class="con-slide">
            <div class="yy-con-title">营养饮食</div>
            <div class="yy-con-list">
              <div class="yy-con-list-title list-flex-top"><i></i><h4 class="list-bd">营养提示</h4></div>
              <div class="yy-con-text">
                <p>建议补充维生素A、钙和维生素D，帮助胎儿骨骼和视网膜发育。日常饮食可适量增加牛奶、鸡蛋、豆制品、深色蔬菜和鱼类摄入，避免长期高油、高糖和刺激性饮食，同时注意少量多餐和规律饮水，以减轻胃肠负担并预防孕期便秘、水肿等常见问题。</p>
              </div>
            </div>
          </div>
        </div>
        <div class="nextArticle-wrap"></div>
      `,
    };

    const document = normalizeAuthorityDocument(source!, raw);

    expect(document).not.toBeNull();
    expect(document?.title).toBe('孕期全指导：怀孕第20周');
    expect(document?.audience).toBe('孕妇');
    expect(document?.topic).toBe('pregnancy');
    expect(document?.contentText).toContain('胎儿发育');
    expect(document?.contentText).toContain('产检提示');
    expect(document?.contentText.length).toBeGreaterThan(80);
  });

  test('normalizes Dayi reviewed QA pages into medical platform authority documents', () => {
    const source = getAuthoritySourceConfig('dayi-maternal-child');
    expect(source).toBeDefined();

    const raw = {
      sourceId: source!.id,
      url: 'https://www.dayi.org.cn/qa/153633.html',
      httpStatus: 200,
      contentType: 'text/html; charset=utf-8',
      contentHash: 'test',
      fetchedAt: '2026-05-02T00:00:00.000Z',
      rawBody: `
        <title>孕妇脚痒怎么办_孕妇脚痒如何治疗| 中国医药信息查询平台</title>
        <meta name="description" content="孕妇脚痒可见于生理现象，也可能与足癣、妊娠期肝内胆汁淤积症等因素有关。">
        <article>
          <div class="article-main">
            <h1>孕妇脚痒怎么办</h1>
            <div class="renzheng">本内容由 国家中医药管理局名词术语成果转化与规范推广项目 审核认证</div>
            <div class="doctor-container">
              <span>李若瑜</span><span>主任医师</span><span>北京大学第一医院</span>
            </div>
            <div class="article-content">
              <p>孕妇脚痒，可见于正常生理现象，也可能与足癣、妊娠期肝内胆汁淤积症等病理因素有关，不同原因的处理有所不同，建议到正规医院皮肤科或产科就诊，配合医生进行相应检查。</p>
              <p>如果与妊娠期体内激素水平变化、局部血流不畅等生理因素有关，通常无需特殊治疗，可通过保持皮肤清洁、穿宽松透气鞋袜、避免过度抓挠、适当抬高下肢等方式缓解。</p>
              <p>如果考虑足癣等真菌感染，应由医生评估后选择相对安全的外用抗真菌药物，不建议自行混用刺激性药膏。若瘙痒发生在妊娠中晚期，并伴手掌、足底或全身瘙痒，应及时就医排查胆汁酸等指标。</p>
              <p>日常护理中应记录症状出现时间、瘙痒范围、皮疹变化、近期用药和产检结果，复诊时带给医生参考。治疗期间遵医嘱复查，避免自行口服药物或使用来源不明的外用产品。</p>
              <p>孕期出现皮肤瘙痒时，还应结合是否伴有皮疹、黄疸、尿色加深、睡眠受影响等情况综合判断。日常可选择温和清洁方式，避免热水长时间烫洗，保持鞋袜干燥透气。若症状持续加重或影响休息，应由产科、皮肤科医生结合孕周和检查结果给出处理方案。</p>
              <p>复诊时可以携带近期产检资料、肝功能和胆汁酸等检查结果，说明瘙痒开始时间、部位、加重因素和已使用的护理用品。医生会根据检查结果判断是否需要进一步评估，并选择相对适合孕期的护理或治疗措施。</p>
              <p>如果只是局部轻度干燥或摩擦引起的不适，通常可先减少抓挠，选择宽松鞋袜并保持皮肤保湿。若瘙痒范围扩大、夜间明显加重，或伴有食欲下降、乏力等表现，则不应只按普通皮肤问题处理，应及时复诊。</p>
              <p>孕妇用药需要特别谨慎，不建议自行购买口服止痒药或激素类药膏。医生会根据孕周、症状严重程度和检查结果权衡处理方式，尽量选择对孕期相对安全的方案，并安排必要的随访观察。</p>
            </div>
            <div class="time">发布时间：2025-11-17 22:08</div>
          </div>
        </article>
      `,
    };

    const document = normalizeAuthorityDocument(source!, raw);

    expect(document).not.toBeNull();
    expect(document?.title).toBe('孕妇脚痒怎么办');
    expect(document?.audience).toBe('孕妇');
    expect(document?.topic).toBe('pregnancy');
    expect(document?.publishStatus).toBe('published');
    expect(document?.updatedAt).toBe('2025-11-17 22:08');
    expect(document?.contentText).toContain('主任医师');
    expect(document?.metadataJson.sourceClass).toBe('medical_platform');
    expect(document?.metadataJson.professionalSignal).toBeTruthy();
  });

  test('normalizes Kepuchina professional articles and trims author department boilerplate', () => {
    const source = getAuthoritySourceConfig('kepuchina-maternal-child');
    expect(source).toBeDefined();

    const raw = {
      sourceId: source!.id,
      url: 'https://www.kepuchina.cn/article/articleinfo?business_type=100&classify=0&ar_id=558464',
      httpStatus: 200,
      contentType: 'text/html; charset=utf-8',
      contentHash: 'test',
      fetchedAt: '2026-05-02T00:00:00.000Z',
      rawBody: `
        <title>新生儿护理须知！- · 科普中国网</title>
        <meta name="Description" content="新生儿护理需要关注喂养、皮肤清洁、脐部护理和睡眠环境。">
        <script type="application/ld+json">
          {
            "@context":"https://schema.org",
            "@type":"Article",
            "headline":"新生儿护理须知！",
            "description":"新生儿护理需要关注喂养、皮肤清洁、脐部护理和睡眠环境。",
            "author":{"@type":"Organization","name":"中华医学会"},
            "publisher":{"@type":"Organization","name":"科普中国"},
            "datePublished":"2024-12-17",
            "dateModified":"2024-12-17"
          }
        </script>
        <article>
          <p>新生儿护理的重点是保证宝宝处在温暖、清洁、安静的环境中，家长应观察吃奶、睡眠、大小便、体温和精神反应等变化，发现明显异常时及时到儿科或新生儿科就诊。</p>
          <p>喂养方面，母乳是婴儿理想食物。出生后应尽早开始哺乳，按需喂养，注意观察含接姿势和吞咽情况。如果妈妈暂时无法母乳喂养，应在医生或专业人员指导下选择合适的配方奶，避免自行加浓奶粉。</p>
          <p>脐部护理要保持干燥清洁，给宝宝洗澡后用干净棉签轻轻擦干脐窝，尿布边缘不要反复摩擦脐带残端。皮肤护理以温和清洁为主，不建议频繁使用成人护肤品或刺激性消毒用品。</p>
          <p>睡眠环境应保持通风和适宜温度，床面平整，避免在宝宝脸部周围堆放松软物品。家长抱起宝宝时要托住头颈，换尿布、洗澡和拍嗝动作要轻柔，减少过度摇晃。</p>
          <p>日常观察要形成简单记录，包括每天吃奶次数、尿布数量、排便颜色、皮肤颜色和哭声变化。若宝宝出现持续拒奶、精神反应差、发热、频繁呕吐、皮肤明显发黄或脐部渗液增多，应及时咨询儿科医生，不要自行使用成人药物或来源不明的护理用品。</p>
          <p>家长还应关注照护者手卫生，接触宝宝前后及时洗手，奶瓶、奶嘴和清洁用品分开存放。外出复诊或接种时，提前准备出生记录、既往检查结果和喂养记录，便于医生快速了解宝宝近期变化并给出更准确的家庭护理建议。</p>
          <p>如果家中有感冒、腹泻或皮肤感染的照护者，应减少近距离接触并佩戴口罩。宝宝衣物和毛巾建议单独清洗、充分晾干，不需要过度消毒。护理过程中以观察整体状态为主，避免只根据单一症状反复更换喂养方式或护理产品。</p>
          <p>宝宝哭闹时，家长可以先检查尿布、饥饿、冷热、皮肤摩擦和腹胀等常见原因，再通过轻拍、拥抱和安静环境安抚。不要剧烈摇晃宝宝，也不要自行处理肚脐、湿疹或黄疸。家庭护理无法判断原因时，应让医生结合体格检查和喂养记录综合评估。</p>
          <p>护理用品选择越简单越好，贴身衣物以柔软透气为主，洗澡水温适中，洗后及时擦干褶皱部位。宝宝房间不需要过度升温，保持适宜湿度和空气流通即可。家长如果对喂养量、睡眠时长或排便变化不确定，可以在复诊时带上记录表咨询专业人员。</p>
          <p>作者 | 王医生 主任医师 新生儿科</p>
          <p>| 科室介绍</p>
          <p>科室长期承担危重新生儿救治工作，相关统计曾提到新生儿死亡率。</p>
        </article>
      `,
    };

    const document = normalizeAuthorityDocument(source!, raw);

    expect(document).not.toBeNull();
    expect(document?.title).toBe('新生儿护理须知！');
    expect(document?.audience).toBe('婴幼儿家长');
    expect(document?.topic).toBe('feeding');
    expect(document?.publishStatus).toBe('published');
    expect(document?.updatedAt).toBe('2024-12-17');
    expect(document?.contentText).toContain('母乳是婴儿理想食物');
    expect(document?.contentText).not.toContain('死亡率');
    expect(document?.metadataJson.sourceClass).toBe('medical_platform');
    expect(document?.metadataJson.professionalSignal).toContain('王医生');
  });

  test('normalizes Haodf doctor-authored articles and rejects page chrome', () => {
    const source = getAuthoritySourceConfig('haodf-maternal-child');
    expect(source).toBeDefined();

    const raw = {
      sourceId: source!.id,
      url: 'https://www.haodf.com/neirong/wenzhang/9394363019.html',
      httpStatus: 200,
      contentType: 'text/html; charset=utf-8',
      contentHash: 'test',
      fetchedAt: '2026-05-02T00:00:00.000Z',
      rawBody: `
        <title>婴幼儿退热用药原则 - 好大夫在线</title>
        <meta name="description" content="婴幼儿发热用药需要结合月龄、体重、精神状态和药品浓度。">
        <meta property="og:release_date" content="2025-05-12">
        <div class="bread-curmb-cert">本站已通过实名认证，所有内容由王医生医生本人发表</div>
        <a class="fdoc_info">
          <span>王医生</span>
          <span>主任医师</span>
          <span>北京儿童医院</span>
          <span>儿科</span>
        </a>
        <p class="art_detail_cate">医学科普</p>
        <div class="article_detail ql-editor">
          <p>一、核心用药原则</p>
          <p>婴幼儿发热时，家长应先观察精神状态、吃奶饮水、尿量、呼吸和皮肤颜色。发热本身不是必须立刻用药的唯一标准，是否使用退热药需要结合孩子舒适度和体温变化。</p>
          <p>三个月以下婴儿发热不建议自行用药，应尽快联系儿科医生评估。三个月以上宝宝如果体温升高并伴有明显不适，可在医生建议或药品说明书范围内选择适合儿童的退热药。</p>
          <p>用药前需要核对药品名称、浓度、剂型和有效期，按照体重计算剂量，不要同时使用多种含同一成分的复方感冒药。喂药后记录时间和剂量，避免短时间内重复给药。</p>
          <p>护理上应保持室内通风，衣物厚薄适中，鼓励少量多次饮水或继续母乳喂养。不要用酒精擦浴，也不要为了退热反复捂汗。</p>
          <p>如果孩子精神反应差、持续呕吐、尿量明显减少、呼吸急促、皮疹快速增多，或发热持续超过三天，应及时到儿科就诊。既往有基础疾病或早产史的宝宝，处理应更加谨慎。</p>
          <p>家长复诊时可以带上体温记录、用药记录、近期接触史和既往检查结果，帮助医生判断感染线索和是否需要进一步检查。</p>
          <p>退热药只能改善不适感，不能替代对病因的判断。家长应避免把成人药掰开给宝宝服用，也不要把不同品牌药物混在一起。若不确定药品成分，应把药盒或说明书拍照带给医生核对。</p>
          <p>居家观察期间，重点看孩子是否能被安抚、是否愿意吃奶或喝水、尿布是否明显减少。体温下降后如果精神状态恢复，通常可以继续观察；如果体温不高但孩子反应很差，也应及时就医。</p>
          <div class="js-qn"></div>
        </div>
        <p class="dc-prompt">本文是王医生版权所有，未经授权请勿转载。</p>
        <div class="collect-btn">收藏</div>
        <p class="gray3 tr fs">发表于：2025-05-12</p>
      `,
    };

    const document = normalizeAuthorityDocument(source!, raw);

    expect(document).not.toBeNull();
    expect(document?.title).toBe('婴幼儿退热用药原则');
    expect(document?.audience).toBe('婴幼儿家长');
    expect(document?.topic).toBe('common-symptoms');
    expect(document?.publishStatus).toBe('published');
    expect(document?.updatedAt).toBe('2025-05-12');
    expect(document?.contentText).toContain('北京儿童医院');
    expect(document?.contentText).toContain('不要用酒精擦浴');
    expect(document?.contentText).not.toContain('收藏');
    expect(document?.metadataJson.sourceClass).toBe('medical_platform');
    expect(document?.metadataJson.professionalSignal).toContain('医生本人发表');
  });

  test('normalizes CMA professional society articles from RSS content markers', () => {
    const source = getAuthoritySourceConfig('cma-kepu-maternal-child');
    expect(source).toBeDefined();

    const raw = {
      sourceId: source!.id,
      url: 'https://www.cma.org.cn/art/2025/10/29/art_4584_60353.html',
      httpStatus: 200,
      contentType: 'text/html; charset=utf-8',
      contentHash: 'test',
      fetchedAt: '2026-05-02T00:00:00.000Z',
      rawBody: `
        <title>中华医学会 科普图文 为什么新生儿会出现生理性黄疸？需要治疗吗？</title>
        <meta name="ArticleTitle" content="为什么新生儿会出现生理性黄疸？需要治疗吗？">
        <meta name="pubdate" content="2025-10-29 09:49"/>
        <meta name="description" content="新生儿黄疸有生理性和病理性之分，生理性黄疸一般在生后2-3天开始出现。">
        <meta name="contentSource" content="中华医学会科学普及部">
        <div id="zoom">
          <!--ZJEG_RSS.content.begin-->
          <p>新生儿黄疸有生理性和病理性之分。生理性黄疸一般在生后2-3天开始出现，5-7天达到高峰。对足月儿来讲，一般7-10天消退，最长不超过2周；对于早产儿来讲，一般3周消退。</p>
          <p><strong>一、为什么新生儿会出现生理性黄疸？</strong></p>
          <p>黄疸涉及胆红素代谢，对于新生儿来讲，胆红素代谢跟成人有所不同。主要是由于过多的红细胞破坏、新生儿红细胞寿命短等因素导致胆红素生成过多；新生儿的肝脏功能不成熟，肝细胞处理胆红素的能力较差。</p>
          <p><strong>二、新生儿生理性黄疸需要治疗吗？</strong></p>
          <p>新生儿生理性黄疸是一个自然过程，一半以上的新生儿都会出现，会自然消退，所以不用治疗，不用吃药。让孩子吃饱喝足，大便排出通畅，促使胆红素代谢出去，对退黄有帮助。</p>
          <p>家长在这期间主要观察孩子的吃奶情况、精神反应情况、体重增长情况，以及黄疸的出现时间、消退时间和变化。如果黄疸重，或者孩子精神状态不好、吃奶差，应到医院就诊。</p>
          <p>作者：王亚娟 首都儿科研究所附属儿童医院 主任医师</p>
          <p>审核：邹丽颖 首都医科大学附属北京妇产医院 主任医师</p>
          <!--ZJEG_RSS.content.end-->
        </div>
      `,
    };

    const document = normalizeAuthorityDocument(source!, raw);

    expect(document).not.toBeNull();
    expect(document?.title).toBe('为什么新生儿会出现生理性黄疸？需要治疗吗？');
    expect(document?.audience).toBe('婴幼儿家长');
    expect(document?.topic).toBe('newborn');
    expect(document?.publishStatus).toBe('published');
    expect(document?.updatedAt).toBe('2025-10-29 09:49');
    expect(document?.contentText).toContain('新生儿生理性黄疸是一个自然过程');
    expect(document?.contentText).not.toContain('中华医学会 科普图文');
    expect(document?.metadataJson.sourceClass).toBe('official');
    expect(document?.metadataJson.professionalSignal).toContain('中华医学会科学普及部');
  });

  test('normalizes FamilyDoctor article pages into authority document text', () => {
    const source = getAuthoritySourceConfig('familydoctor-maternal');
    expect(source).toBeDefined();

    const raw = {
      sourceId: source!.id,
      url: 'https://www.familydoctor.com.cn/a/202403/3045081.html',
      httpStatus: 200,
      contentType: 'text/html; charset=utf-8',
      contentHash: 'test',
      fetchedAt: '2026-04-09T00:00:00.000Z',
      rawBody: `
        <title>宝贝成长秘籍：婴儿健康护理与营养指南 - 家庭医生在线家庭医生在线首页频道</title>
        <meta name="description" content="随着小生命的降临，新手父母们都会面临许多关于婴儿健康护理与营养的疑问。">
        <script type="application/ld+json">{"pubDate":"2024-03-19T20:26:27","upDate":"2025-08-08T10:01:50"}</script>
        <div class="article-titile">
          <h1>宝贝成长秘籍：婴儿健康护理与营养指南</h1>
          <div class="info clearfix">
            <div class="left">2024-03-19 20:26:27&nbsp;&nbsp;&nbsp;</div>
          </div>
        </div>
        <div id="viewContent" class="viewContent js-detail">
          <p>随着小生命的降临，新手父母们都会面临许多关于婴儿健康护理与营养的疑问。</p>
          <p><b>一、婴儿成长过程中需要注意什么？</b></p>
          <p>保持宝宝皮肤清洁，定期更换尿布，注意口腔卫生，帮助降低尿布疹和感染风险。</p>
          <p>婴儿需要充足的睡眠来促进生长发育，一般每天需要睡14-17小时，家长应营造安静、舒适的睡眠环境。</p>
          <p><b>二、婴儿营养需求有哪些特点？</b></p>
          <p>母乳是最好的营养来源，建议在条件允许时优先母乳喂养，并在6个月后循序渐进添加辅食。</p>
          <p>辅食添加要遵循由少到多、由稀到稠、由一种到多种的原则，同时留意过敏和消化不良表现。</p>
          <p><b>三、婴儿常见疾病及预防措施有哪些？</b></p>
          <p>家长应关注感冒、腹泻、湿疹等常见问题，注意室内通风、饮食卫生和皮肤清洁，并在症状持续或加重时及时就医。</p>
          <p>照顾宝宝的过程中要保持耐心和细心，持续关注成长变化、进食情况和精神状态，必要时向专业医生求助。</p>
        </div>
        <script>console.log('after content')</script>
      `,
    };

    const document = normalizeAuthorityDocument(source!, raw);

    expect(document).not.toBeNull();
    expect(document?.title).toBe('宝贝成长秘籍：婴儿健康护理与营养指南');
    expect(document?.audience).toBe('婴幼儿家长');
    expect(document?.contentText).toContain('婴儿成长过程中需要注意什么');
    expect(document?.metadataJson.sourceClass).toBe('medical_platform');
    expect(document?.contentText.length).toBeGreaterThan(180);
  });

  test('normalizes Yilianmeiti article pages but keeps disabled automatic source out of publishing', () => {
    const source = getAuthoritySourceConfig('yilianmeiti-maternal-child');
    expect(source).toBeDefined();

    const raw = {
      sourceId: source!.id,
      url: 'https://www.yilianmeiti.com/article/2528524.html',
      httpStatus: 200,
      contentType: 'text/html; charset=utf-8',
      contentHash: 'test',
      fetchedAt: '2026-04-26T00:00:00.000Z',
      rawBody: `
        <title>孩子从昨天晚上发烧了_医联媒体</title>
        <meta name="description" content="孩子发烧的原因有很多，最常见的是感染，如感冒、流感、肺炎等。">
        <h1>孩子从昨天晚上发烧了</h1>
        <div class="cop-doctor">
          <strong>李兰娜</strong><em>广州市妇女儿童医疗中心 小儿内科</em>
        </div>
        <div class="detail">
          <p>孩子发烧的原因有很多，最常见的是感染，如感冒、流感、肺炎等。</p>
          <p>观察孩子的症状：除了发烧，孩子是否还有其他症状，如咳嗽、流鼻涕、喉咙痛、呕吐、腹泻等。</p>
          <p>给孩子多喝水：发烧会使孩子失去大量的水分，因此家长应该给孩子多喝水，以补充水分和防止脱水。</p>
          <p>给孩子穿轻便、透气的衣服。体温超过38.5℃时，可在医生建议下使用退烧药，不要自行增加剂量。</p>
          <p>护理过程中应记录体温变化、精神状态、进食饮水和尿量，避免反复包裹捂汗，也不要混用多种退热药。</p>
          <p>婴幼儿、基础疾病儿童或三个月以下宝宝出现发热时，应更谨慎评估，必要时尽快到儿科门诊处理。</p>
          <p>如果发烧持续时间过长、症状加重或出现抽搐、昏迷等异常情况，应该及时带孩子去看医生。</p>
        </div>
        <div class="customer"></div>
        <script type="application/ld+json">{"pubDate":"2024-11-19T17:16:44"}</script>
      `,
    };

    const document = normalizeAuthorityDocument(source!, raw);

    expect(document).not.toBeNull();
    expect(document?.title).toBe('孩子从昨天晚上发烧了');
    expect(document?.audience).toBe('婴幼儿家长');
    expect(document?.topic).toBe('common-symptoms');
    expect(document?.riskLevelDefault).toBe('red');
    expect(document?.publishStatus).toBe('rejected');
    expect(document?.updatedAt).toBe('2024-11-19T17:16:44');
    expect(document?.contentText).toContain('观察孩子的症状');
    expect(document?.metadataJson.sourceClass).toBe('medical_platform');
  });

  test('normalizes NCWCH detail pages from article content instead of page navigation', () => {
    const source = getAuthoritySourceConfig('ncwch-maternal-child-health');
    expect(source).toBeDefined();

    const raw = {
      sourceId: source!.id,
      url: 'https://www.ncwchnhc.org.cn/content/content.html?id=7313481602116358144',
      httpStatus: 200,
      contentType: 'text/html; charset=utf-8',
      contentHash: 'test',
      fetchedAt: '2026-04-27T00:00:00.000Z',
      rawBody: `
        <title>科普知识-国家卫生健康委妇幼健康中心</title>
        <article>
          <h2 data-diy-id="7313481602116358144">体重管理指导原则（2024年版）—孕前、孕期及产后女性体重管理</h2>
          <div id="content" class="clearfix">
            <p>孕前体重管理应通过合理膳食和适量运动，将体重调整到适宜范围。</p>
            <p>孕期体重管理需要结合孕早期、孕中期和孕晚期能量需求，定期监测体重增长。</p>
            <p>产后体重管理应支持母乳喂养，膳食多样，不过量进补，并循序渐进恢复运动。</p>
            <p>家庭和基层妇幼保健机构可结合身高、体重、体质指数和孕周变化进行连续指导，帮助女性降低妊娠期并发症和产后体重滞留风险。</p>
          </div><p><br></p>
        </article>
      `,
    };

    const document = normalizeAuthorityDocument(source!, raw);

    expect(document).not.toBeNull();
    expect(document?.title).toBe('体重管理指导原则（2024年版）—孕前、孕期及产后女性体重管理');
    expect(document?.contentText).toContain('孕期体重管理');
    expect(document?.contentText).not.toContain('中心介绍');
  });

  test('normalizes NHC xw_box article content without header navigation chrome', () => {
    const source = getAuthoritySourceConfig('nhc-fys');
    expect(source).toBeDefined();

    const raw = {
      sourceId: source!.id,
      url: 'https://www.nhc.gov.cn/fys/c100077/202604/40f484ecee894fcd89209cc8342d5289.shtml',
      httpStatus: 200,
      contentType: 'text/html; charset=utf-8',
      contentHash: 'test',
      fetchedAt: '2026-04-28T00:00:00.000Z',
      rawBody: `
        <meta name="ArticleTitle" content="儿童青少年“五健”促进行动启动"/>
        <meta name="PubDate" content="2026-04-28 17:13:34"/>
        <title>儿童青少年“五健”促进行动启动</title>
        <div class="header">中文 | 英文 妇幼健康司 首页 工作动态 政策文件 关于我们 专题专栏 返回主站 ></div>
        <div class="list">
          <div class="tit">儿童青少年“五健”促进行动启动</div>
          <div class="source">
            <span>发布时间：2026-04-28</span>
            <span class="mr">来源: 妇幼健康司</span>
          </div>
          <div class="con" id="xw_box">
            <p><span>4月2</span><span>8</span><span>日</span><span>下午</span>，“做‘五健’少年 筑健康中国”主题宣传倡导活动暨儿童青少年“五健”促进行动启动式在京举行。</p>
            <p>维护儿童青少年体重、视力、心理、骨骼、口腔五个领域健康，需要家庭、学校、医疗卫生机构和社会各界协同发力。</p>
            <p>专家针对儿童青少年常见健康误区进行科普解读，倡导家长关注孩子日常运动、营养、睡眠和口腔健康。</p>
            <div class="clear"></div>
          </div>
        </div>
      `,
    };

    const document = normalizeAuthorityDocument(source!, raw);

    expect(document).not.toBeNull();
    expect(document?.title).toBe('儿童青少年“五健”促进行动启动');
    expect(document?.summary).toContain('4月28日下午');
    expect(document?.contentText).toContain('儿童青少年体重');
    expect(document?.contentText).not.toContain('中文 | 英文');
    expect(document?.contentText).not.toContain('返回主站');
  });

  test('normalizes Mayo Chinese maternal-child articles by Chinese title and body text', () => {
    const source = getAuthoritySourceConfig('mayo-clinic-zh');
    expect(source).toBeDefined();

    const raw = {
      sourceId: source!.id,
      url: 'https://www.mayoclinic.org/zh-hans/healthy-lifestyle/infant-and-toddler-health/in-depth/baby-poop/art-20043980',
      httpStatus: 200,
      contentType: 'text/html; charset=utf-8',
      contentHash: 'test',
      fetchedAt: '2026-04-28T00:00:00.000Z',
      rawBody: `
        <title>婴儿大便：什么是正常的？ - Mayo Clinic</title>
        <meta name="description" content="了解婴儿大便颜色和频率的常见变化，以及何时需要咨询儿科医生。">
        <main>
          <article>
            <h1>婴儿大便：什么是正常的？</h1>
            <p>新生儿和婴儿的大便颜色、质地和次数会随着喂养方式、月龄和辅食添加而变化。</p>
            <p>母乳喂养的宝宝可能排便更频繁，配方奶喂养的宝宝大便通常更成形，家长可以结合尿量、精神状态和体重增长观察。</p>
            <p>如果宝宝同时出现发热、持续呕吐、明显腹泻、精神差或尿量减少，应联系儿科医生评估。</p>
            <p>多数轻微变化可以通过继续按需喂养、记录排便情况、保持臀部清洁和观察宝宝整体状态来处理。</p>
            <p>添加辅食后，食物颜色可能影响大便外观，家长应逐步添加新食材并留意过敏、便秘或腹泻表现。</p>
          </article>
        </main>
      `,
    };

    const document = normalizeAuthorityDocument(source!, raw);

    expect(document).not.toBeNull();
    expect(document?.audience).toBe('婴幼儿家长');
    expect(document?.topic).toBe('newborn');
    expect(document?.contentText).toContain('新生儿和婴儿的大便颜色');
  });

  test('rejects Chinese navigation documents even when page chrome contains maternal-child words', () => {
    const source = getAuthoritySourceConfig('mchscn-monitoring');
    expect(source).toBeDefined();

    const raw = {
      sourceId: source!.id,
      url: 'https://www.mchscn.cn/MaternalSafetyMonitoring-26.html',
      httpStatus: 200,
      contentType: 'text/html; charset=utf-8',
      contentHash: 'test',
      fetchedAt: '2026-04-27T00:00:00.000Z',
      rawBody: `
        <title>孕产妇安全监测_中国妇幼健康监测</title>
        <div class="nav">首页 新闻中心 技术规范 工作指南 监测结果 通讯专栏 继续教育 基层交流 共享资源 关于我们</div>
        <div class="news-list">
          <a href="/MaternalSafetyMonitoring-26/682.html">孕产妇死亡监测表卡及项目数标注（2025）</a>
          <a href="/MaternalSafetyMonitoring-26/657.html">孕产妇安全监测表卡及项目数标注</a>
        </div>
      `,
    };

    expect(normalizeAuthorityDocument(source!, raw)).toBeNull();
  });

  test('keeps image-only Chinese guidance pages as OCR candidates without publishing them', () => {
    const source = getAuthoritySourceConfig('cnsoc-dietary-guidelines');
    expect(source).toBeDefined();

    const raw = {
      sourceId: source!.id,
      url: 'http://dg.cnsoc.org/article/04/gc5cUak3RhSGheqSaRljnA.html',
      httpStatus: 200,
      contentType: 'text/html; charset=utf-8',
      contentHash: 'test',
      fetchedAt: '2026-04-27T00:00:00.000Z',
      rawBody: `
        <title>《中国婴幼儿喂养指南（2022）》核心信息_中国居民膳食指南</title>
        <div class="right-con news-show">
          <h1>《中国婴幼儿喂养指南（2022）》核心信息</h1>
          <div class="con">
            <p><strong>0~6月龄婴儿母乳喂养指南</strong></p>
            <p><img title="1.jpg" src="/upload/1.jpg" alt="婴儿母乳喂养指南图示"></p>
            <p><img title="2.jpg" src="/upload/2.jpg" alt="7~24月龄婴幼儿喂养指南图示"></p>
          </div>
        </div>
      `,
    };

    const document = normalizeAuthorityDocument(source!, raw);

    expect(document).not.toBeNull();
    expect(document?.publishStatus).toBe('rejected');
    expect(document?.metadataJson.ocrCandidate).toBe(true);
    expect(Number(document?.metadataJson.imageCount)).toBeGreaterThan(0);
  });

  test('infers multiple stage buckets for general pregnancy authority content', () => {
    expect(inferAuthorityStages({
      title: '孕期营养补充建议',
      summary: '适用于大多数孕妇的日常补充原则',
      audience: '孕妇',
      topic: 'pregnancy',
    })).toEqual(['first-trimester', 'second-trimester', 'third-trimester']);
  });

  test('infers concrete stage from explicit week text', () => {
    expect(inferAuthorityStages({
      title: '怀孕第20周',
      contentText: '本周重点关注胎动和大排畸检查。',
      audience: '孕妇',
      topic: 'pregnancy',
    })[0]).toBe('second-trimester');
  });

  test('infers infant stage buckets for newborn feeding guidance', () => {
    expect(inferAuthorityStages({
      title: '新生儿母乳喂养指导',
      contentText: '出生后 24 小时内尽早开奶，观察黄疸和奶量变化。',
      audience: '新生儿家长',
      topic: 'feeding',
    })).toEqual(['0-6-months']);
  });

  test('does not infer pregnancy stage from noisy site navigation text on infant articles', () => {
    expect(inferAuthorityStages({
      title: 'Baby Sunburn Prevention',
      summary: 'Discusses how to protect infants younger than 6 months.',
      contentText: 'Prenatal Decisions to Make Delivery and Beyond Baby (0-12 mos.) Bathing & Skin Care Babies younger than 6 months should be kept out of direct sunlight.',
      audience: '婴幼儿家长',
      topic: 'vaccination',
    })).toEqual(['0-6-months', '6-12-months']);
  });

  test('detects infant topic and audience from title and url even when content includes pregnancy navigation noise', () => {
    const source = getAuthoritySourceConfig('aap');
    expect(source).toBeDefined();

    const input = {
      sourceUrl: 'https://www.healthychildren.org/English/ages-stages/baby/bathing-skin-care/Pages/Baby-Sunburn-Prevention.aspx',
      title: 'Baby Sunburn Prevention - HealthyChildren.org',
      summary: 'The American Academy of Pediatrics discusses baby sunburn prevention.',
      contentText: 'Prenatal Decisions to Make Delivery and Beyond Baby (0-12 mos.) Toddler 1-3yrs. Babies younger than 6 months should be kept out of direct sunlight.',
    };

    expect(detectTopic(input, source!)).toBe('newborn');
    expect(detectAudience(input, source!)).toBe('婴幼儿家长');
  });

  test('detects pregnancy topic and audience for acog pregnancy article', () => {
    const source = getAuthoritySourceConfig('acog');
    expect(source).toBeDefined();

    const input = {
      sourceUrl: 'https://www.acog.org/womens-health/faqs/pregnancy-at-age-35-years-or-older',
      title: 'Pregnancy at Age 35 Years or Older | ACOG',
      summary: 'Questions and answers about pregnancy at age 35 years or older.',
      contentText: 'Topics Conditions Baby Feeding and family health navigation text.',
    };

    expect(detectTopic(input, source!)).toBe('pregnancy');
    expect(detectAudience(input, source!)).toBe('孕妇');
  });

  test('extractTitle removes coveo search prefix and prefers metadata title', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="value is what Coveo indexes and uses as the title in Search Results.--> Pregnancy at Age 35 Years or Older | ACOG">
          <title>Some noisy fallback title</title>
        </head>
        <body>
          <h1>Pregnancy at Age 35 Years or Older</h1>
        </body>
      </html>
    `;

    expect(extractTitle(html)).toBe('Pregnancy at Age 35 Years or Older');
  });

  test('sanitizeAuthorityTitle removes known authority site suffixes', () => {
    expect(extractTitle('<title>Baby Sunburn Prevention - HealthyChildren.org</title>')).toBe('Baby Sunburn Prevention');
    expect(extractTitle('<title>Pregnancy at Age 35 Years or Older | ACOG</title>')).toBe('Pregnancy at Age 35 Years or Older');
  });

  test('publishes yellow-risk maternal guidance so common Chinese medical articles enter the cache', () => {
    expect(shouldPublishDocument({
      sourceId: 'msd-manuals-cn',
      sourceOrg: 'MSD Manuals',
      sourceUrl: 'https://www.msdmanuals.cn/home/childrens-health-issues/symptoms-in-infants-and-children/fever-in-infants-and-children',
      sourceLanguage: 'zh',
      sourceLocale: 'zh-CN',
      title: '儿童发热',
      updatedAt: '2026-04-18T00:00:00.000Z',
      audience: '婴幼儿家长',
      topic: 'common-symptoms',
      region: 'GLOBAL',
      riskLevelDefault: 'yellow',
      summary: '介绍儿童发热的常见原因和处理思路。',
      contentText: '儿童发热是常见症状。'.repeat(40),
      metadataJson: {},
      publishStatus: 'draft',
    })).toBe('published');
  });

  test('allows concise official Chinese authority notices into the cache but keeps short platform articles rejected', () => {
    expect(shouldPublishDocument({
      sourceId: 'chinacdc-immunization',
      sourceOrg: '中国疾病预防控制中心',
      sourceUrl: 'https://www.chinacdc.cn/jkkp/mygh/ztrxc/202504/t20250411_305918.html',
      sourceLanguage: 'zh',
      sourceLocale: 'zh-CN',
      title: '全国儿童预防接种日宣传核心信息',
      updatedAt: '2026-04-18T00:00:00.000Z',
      audience: '婴幼儿家长',
      topic: 'vaccination',
      region: 'CN',
      riskLevelDefault: 'green',
      summary: '儿童预防接种核心宣传信息。',
      contentText: '全国儿童预防接种日核心宣传信息，倡导适龄儿童按程序完成接种，家长及时查验接种证并咨询接种门诊。'.repeat(2),
      metadataJson: {},
      publishStatus: 'draft',
    })).toBe('published');

    expect(shouldPublishDocument({
      sourceId: 'familydoctor-maternal',
      sourceOrg: '家庭医生在线',
      sourceUrl: 'https://www.familydoctor.com.cn/baby/a/202604/3948358.html',
      sourceLanguage: 'zh',
      sourceLocale: 'zh-CN',
      title: '宝宝发烧怎么办',
      updatedAt: '2026-04-18T00:00:00.000Z',
      audience: '婴幼儿家长',
      topic: 'common-symptoms',
      region: 'CN',
      riskLevelDefault: 'green',
      summary: '短内容示例。',
      contentText: '短内容提示。'.repeat(20),
      metadataJson: {},
      publishStatus: 'draft',
    })).toBe('rejected');
  });

  test('keeps red-risk emergency guidance in review queue', () => {
    expect(shouldPublishDocument({
      sourceId: 'cdc',
      sourceOrg: 'CDC',
      sourceUrl: 'https://www.cdc.gov/pregnancy/emergency-warning-signs.html',
      sourceLanguage: 'en',
      sourceLocale: 'en-US',
      title: 'Emergency Warning Signs During Pregnancy',
      updatedAt: '2026-04-18T00:00:00.000Z',
      audience: '孕妇',
      topic: 'pregnancy',
      region: 'US',
      riskLevelDefault: 'red',
      summary: 'Emergency warning signs requiring urgent care.',
      contentText: 'Emergency warning signs during pregnancy require urgent evaluation. '.repeat(20),
      metadataJson: {},
      publishStatus: 'draft',
    })).toBe('review');
  });

  test('exports already-reviewed yellow-risk documents but keeps red review documents gated', () => {
    expect(shouldExportAuthoritySnapshotDocument({
      publishStatus: 'review',
      riskLevelDefault: 'yellow',
    })).toBe(true);

    expect(shouldExportAuthoritySnapshotDocument({
      publishStatus: 'review',
      riskLevelDefault: 'red',
    })).toBe(false);

    expect(shouldExportAuthoritySnapshotDocument({
      publishStatus: 'published',
      riskLevelDefault: 'red',
    })).toBe(true);
  });
});

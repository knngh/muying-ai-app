import { getAuthoritySourceConfig } from '../src/config/authority-sources';
import { __authoritySyncTestUtils, normalizeAuthorityDocument, shouldExportAuthoritySnapshotDocument } from '../src/services/authority-sync.service';
import { detectAudience, detectTopic, extractTitle, shouldPublishDocument } from '../src/services/authority-adapters/base.adapter';
import { inferAuthorityStages } from '../src/utils/authority-stage';

describe('authority index discovery', () => {
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

  test('prioritizes Mayo Chinese maternal-child article URLs before department pages from large sitemap files', () => {
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
    expect(links[links.length - 1]).toBe('https://www.mayoclinic.org/zh-hans/departments-centers/childrens-center/overview/specialty-groups/newborn-intensive-care-unit-follow-up-clinic');
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

  test('normalizes Yilianmeiti article pages into medical platform authority documents', () => {
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
    expect(document?.publishStatus).toBe('review');
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

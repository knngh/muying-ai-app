import { getAuthoritySourceConfig } from '../src/config/authority-sources';
import { __authoritySyncTestUtils, normalizeAuthorityDocument } from '../src/services/authority-sync.service';
import { detectAudience, detectTopic, extractTitle } from '../src/services/authority-adapters/base.adapter';
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
});

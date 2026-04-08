import { getAuthoritySourceConfig } from '../src/config/authority-sources';
import { __authoritySyncTestUtils } from '../src/services/authority-sync.service';

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
});

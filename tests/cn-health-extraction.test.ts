import { getAuthoritySourceConfig } from '../src/config/authority-sources';
import { cnHealthAdapter } from '../src/services/authority-adapters/cn-health.adapter';
import { extractMetaContent } from '../src/services/authority-adapters/base.adapter';
import { getOfficialChineseAuthorityQualityDropReason } from '../src/utils/official-chinese-authority-quality';

const first = '婴幼儿辅食喂养需要关注食物多样性，家长应根据孩子的发育情况循序渐进地安排膳食。'.repeat(5);
const last = '正文最后一段：保持食物清洁，耐心观察进食情况，定期关注宝宝生长发育。';

describe('Chinese authority article extraction', () => {
  it('keeps physical activity advice while continuing to exclude event announcements', () => {
    const record = { sourceId: 'chinacdc-nutrition', title: '母乳喂养与产后恢复', summary: '产后恢复与膳食结构、身体活动和睡眠有关。', contentText: first.repeat(4) };
    expect(getOfficialChineseAuthorityQualityDropReason(record)).toBeNull();
    expect(getOfficialChineseAuthorityQualityDropReason({ ...record, title: '母乳喂养宣传活动', summary: '组织开展主题活动。' }))
      .toBe('official_chinese_activity_or_admin');
  });
  it('prefers the visible China CDC article heading and publication date over body text or URL dates', () => {
    const source = getAuthoritySourceConfig('chinacdc-nutrition')!;
    const document = cnHealthAdapter.normalize(source, {
      sourceId: source.id, url: 'https://www.chinacdc.cn/jkkp/yyjk/rqyy/202408/t20240825_295584.html',
      httpStatus: 200, contentType: 'text/html', contentHash: 'fixture', fetchedAt: '2026-11-09T00:00:00Z',
      rawBody: `<title>中国疾病预防控制中心</title><h5><a>母乳喂养与产后恢复建议</a></h5>
        <div class="xqCon clearfix"><span class="fb">时间：<em>2023-11-23</em></span></div>
        <div class=TRS_Editor><p>很多哺乳期妈妈都有这样的困惑。</p><p>${first}</p></div>`,
    });
    expect(document?.title).toBe('母乳喂养与产后恢复建议');
    expect(document?.updatedAt).toBe('2023-11-23');
  });

  it.each(['TRS_Editor', 'trs_editor_view'])('keeps nested %s content through the final paragraph and excludes page chrome', className => {
    const source = getAuthoritySourceConfig('chinacdc-nutrition')!;
    const document = cnHealthAdapter.normalize(source, {
      sourceId: source.id, url: 'https://www.chinacdc.cn/jkkp/yyjk/rqyy/202408/t20240825_295584.html',
      httpStatus: 200, contentType: 'text/html', contentHash: 'fixture', fetchedAt: '2026-11-09T00:00:00Z',
      rawBody: `<title>中国疾病预防控制中心</title><meta content="2023-11-23" name="PubDate">
        <header>导航栏文字</header><div class=${className}>
        <p><strong>6-23月龄婴幼儿辅食喂养指南</strong></p>
        <div data-note="a > b"><p>${first}</p><div>嵌套说明</div></div>
        <!-- </div> --><script>const template = '</div>';</script><p>${last}</p></div>
        <footer>版权和导航尾部</footer>`,
    });
    expect(document?.contentText).toContain(last);
    expect(document?.contentText).not.toContain('导航栏文字');
    expect(document?.contentText).not.toContain('版权和导航尾部');
    expect(document?.contentText).not.toContain('b">');
    expect(document?.updatedAt).toBe('2023-11-23');
  });

  it('does not fill a short article with navigation to pass the content threshold', () => {
    const source = getAuthoritySourceConfig('chinacdc-nutrition')!;
    expect(cnHealthAdapter.normalize(source, {
      sourceId: source.id, url: 'https://www.chinacdc.cn/jkkp/yyjk/rqyy/202408/t20240825_295584.html',
      httpStatus: 200, contentType: 'text/html', contentHash: 'fixture', fetchedAt: '2026-11-09T00:00:00Z',
      rawBody: `<title>婴幼儿辅食喂养</title><nav>${first}</nav><div class=TRS_Editor><p>婴幼儿辅食喂养</p><p>内容待补充。</p></div>`,
    })).toBeNull();
  });

  it('reads reordered metadata and decodes character references once', () => {
    expect(extractMetaContent('<meta content="孕期 &quot;饮食&quot; &#x4e0e; &#33829;养" property="og:title">', 'og:title'))
      .toBe('孕期 "饮食" 与 营养');
  });
});

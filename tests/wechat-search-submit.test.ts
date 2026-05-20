import {
  buildWechatSearchPage,
  buildWechatSearchSubmitPayload,
  chunkWechatSearchPages,
  fetchWechatAccessToken,
  submitWechatSearchPages,
} from '../src/services/wechat-search-submit.service';

describe('wechat search submit payload', () => {
  it('builds a knowledge detail page with encoded slug and structured article data', () => {
    const result = buildWechatSearchPage({
      id: 42n,
      slug: 'pregnancy-week-16',
      title: '孕 16 周宝宝大约多大',
      summary: '<p>本周可以重点关注胎动、产检和饮食。</p>',
      content: '<h2>本周重点</h2><p>宝宝正在快速发育&nbsp;&amp;&nbsp;妈妈需要规律产检。</p>',
      coverImage: 'https://cdn.example.com/cover.jpg',
      source: '贝护妈妈知识库',
      tags: ['孕中期', '产检', '孕中期'],
      viewCount: 18,
      likeCount: 2,
      publishedAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-20T00:00:00.000Z',
    }, {
      now: new Date('2026-05-20T08:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.page.path).toBe('pages/knowledge-detail/index');
    expect(result.page.query).toBe('slug=pregnancy-week-16');
    expect(result.page.data_list[0]).toMatchObject({
      '@type': 'wxsearch_testcpdata',
      update: 1,
      content_id: 'article_42',
      page_type: 2,
      category_id: 17,
      weapp_url: 'pages/knowledge-detail/index?slug=pregnancy-week-16',
      title: '孕 16 周宝宝大约多大',
      abstract: ['本周可以重点关注胎动、产检和饮食。'],
      mainbody: '本周重点\n宝宝正在快速发育 & 妈妈需要规律产检。',
      cover_img: [{ cover_img_url: 'https://cdn.example.com/cover.jpg', cover_img_size: 1 }],
      time_publish: 1777593600,
      time_modify: 1779235200,
      tag: ['孕中期', '产检'],
      pv: 18,
      like: 2,
      author_name: '贝护妈妈知识库',
    });
  });

  it('skips pages without slug, title or body', () => {
    const result = buildWechatSearchSubmitPayload([
      { slug: '', title: '缺 slug', content: '正文' },
      { slug: 'missing-title', title: '', content: '正文' },
      { slug: 'missing-body', title: '缺正文', content: '' },
      { slug: 'ok', title: '可提交', content: '正文' },
    ]);

    expect(result.payload.pages).toHaveLength(1);
    expect(result.skipped.map((item) => item.reason)).toEqual([
      'missing_slug',
      'missing_title',
      'missing_mainbody',
    ]);
  });

  it('chunks pages at the WeChat per-request limit', () => {
    const pages = Array.from({ length: 1001 }, (_item, index) => ({
      path: 'pages/knowledge-detail/index',
      query: `slug=item-${index}`,
      data_list: [{
        '@type': 'wxsearch_testcpdata' as const,
        update: 1 as const,
        content_id: `article_${index}`,
        page_type: 2 as const,
        category_id: 17,
        weapp_url: `pages/knowledge-detail/index?slug=item-${index}`,
        title: `item-${index}`,
        mainbody: `body-${index}`,
        time_publish: 1777593600,
        time_modify: 1777593600,
      }],
    }));

    expect(chunkWechatSearchPages(pages).map((chunk) => chunk.length)).toEqual([1000, 1]);
  });

  it('treats non-zero WeChat errcode as submit failure', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(
      JSON.stringify({ errcode: 40001, errmsg: 'invalid credential' }),
      { status: 200 },
    ));
    const pageResult = buildWechatSearchPage({
      slug: 'ok',
      title: '可提交',
      content: '正文',
    });

    expect(pageResult.ok).toBe(true);
    if (!pageResult.ok) return;

    await expect(submitWechatSearchPages('token', [pageResult.page], fetchMock as typeof fetch))
      .rejects
      .toThrow('40001 invalid credential');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('access_token=token'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fetches WeChat access token with app id and secret', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(
      JSON.stringify({ access_token: 'token-123', expires_in: 7200 }),
      { status: 200 },
    ));

    await expect(fetchWechatAccessToken('wx-app', 'secret-value', fetchMock as typeof fetch))
      .resolves
      .toBe('token-123');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('grant_type=client_credential'));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('appid=wx-app'));
  });

  it('fails access token fetch on WeChat errcode', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(
      JSON.stringify({ errcode: 40164, errmsg: 'invalid ip' }),
      { status: 200 },
    ));

    await expect(fetchWechatAccessToken('wx-app', 'secret-value', fetchMock as typeof fetch))
      .rejects
      .toThrow('40164 invalid ip');
  });
});

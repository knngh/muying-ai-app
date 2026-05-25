import { resolveArticleSourceUrl } from '../src/utils/article-source-url';

describe('article source url resolution', () => {
  test('uses an explicit sourceUrl first', () => {
    expect(resolveArticleSourceUrl({
      sourceUrl: 'https://www.nhc.gov.cn/article.html',
      source: '国家卫健委',
    })).toBe('https://www.nhc.gov.cn/article.html');
  });

  test('falls back to source when old articles stored the URL there', () => {
    expect(resolveArticleSourceUrl({
      source: 'https://www.chinacdc.cn/jkkp/mygh/article.html',
    })).toBe('https://www.chinacdc.cn/jkkp/mygh/article.html');
  });

  test('falls back to references when source is only an organization name', () => {
    expect(resolveArticleSourceUrl({
      source: '美国儿科学会',
      references: [
        { title: 'AAP', url: 'https://www.healthychildren.org/example' },
      ],
    })).toBe('https://www.healthychildren.org/example');
  });

  test('ignores non-http source values', () => {
    expect(resolveArticleSourceUrl({
      source: 'javascript:alert(1)',
      references: [{ url: 'ftp://example.com/a' }],
    })).toBe('');
  });
});

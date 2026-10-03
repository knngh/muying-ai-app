import { authorityBrowsePriority, authorityListCacheKey, matchesAuthorityBrowseCategory } from '../src/utils/authority-browse';
import { matchesExpandedSearch } from '../src/utils/search-query-expansion';

describe('authority knowledge browsing', () => {
  it('maps frontend category slugs onto authority topics and stages', () => {
    const article = { title: '婴儿母乳喂养', topic: '喂养', targetStages: ['0-6-months'] };
    expect(matchesAuthorityBrowseCategory(article, 'nutrition-baby')).toBe(true);
    expect(matchesAuthorityBrowseCategory(article, 'parenting-0-1')).toBe(true);
    expect(matchesAuthorityBrowseCategory(article, 'nutrition-pregnancy')).toBe(false);
    expect(matchesAuthorityBrowseCategory({ title: '产检', topic: '孕期', targetStages: ['first-trimester'] }, 'pregnancy-early')).toBe(true);
    expect(matchesAuthorityBrowseCategory({ title: '疫苗指南', topic: '疫苗' }, 'faq-vaccine')).toBe(true);
  });

  it('finds English breastfeeding content without waiting for AI rewriting', () => {
    expect(matchesExpandedSearch('母乳', 'Infant breastfeeding guidance')).toBe(true);
    expect(matchesExpandedSearch('母乳', 'Preparing for childbirth')).toBe(false);
  });
  it('recommends educational guidance before dated news without removing news', () => {
    const urls = [
      'https://www.who.int/zh/news-room/detail/23-10-2015-pilot-vaccine',
      'https://www.who.int/es/news-room/detail/07-05-2018-vaccine-drive',
      'https://www.nhs.uk/pregnancy/keeping-well/foods-to-avoid/',
      'https://www.who.int/news-room/fact-sheets/detail/infant-and-young-child-feeding',
    ];
    const sorted = [...urls].sort((a, b) => authorityBrowsePriority(a) - authorityBrowsePriority(b));
    expect(sorted.slice(0, 2)).toEqual(urls.slice(2));
    expect(sorted).toHaveLength(4);
  });

  it('keeps WHO questions and answers in the educational group', () => {
    expect(authorityBrowsePriority('https://www.who.int/news-room/questions-and-answers/item/breastfeeding')).toBe(0);
    expect(authorityBrowsePriority('https://www.who.int/news/item/announcement')).toBeGreaterThan(0);
  });

  it('puts practical feeding and pregnancy guidance before broad public-health reading', () => {
    const publicHealth = authorityBrowsePriority('https://www.who.int/news-room/fact-sheets/detail/violence-against-children', '母婴知识');
    const feeding = authorityBrowsePriority('https://www.nhs.uk/baby/breastfeeding/', '喂养');
    const pregnancy = authorityBrowsePriority('https://www.nhs.uk/pregnancy/', '孕期');
    const news = authorityBrowsePriority('https://www.who.int/news-room/detail/announcement', '疫苗');
    expect(feeding).toBeLessThan(publicHealth);
    expect(pregnancy).toBeLessThan(publicHealth);
    expect(publicHealth).toBeLessThan(news);
  });

  it('does not share first-page responses across page sizes, sort orders or filters', () => {
    const baseline = { page: 1, pageSize: 10, sort: 'recommended' };
    const key = authorityListCacheKey(baseline);
    for (const change of [{ pageSize: 2 }, { sort: 'latest' }, { stage: 'postpartum' }, { keyword: '辅食' }]) {
      expect(authorityListCacheKey({ ...baseline, ...change })).not.toBe(key);
    }
    expect(authorityListCacheKey({ ...baseline, category: 'a:b', tag: 'c' }))
      .not.toBe(authorityListCacheKey({ ...baseline, category: 'a', tag: 'b:c' }));
  });
});

import { authorityBrowsePriority, authorityListCacheKey, matchesAuthorityBrowseCategory, matchesAuthoritySourceLanguage } from '../src/utils/authority-browse';
import { matchesExpandedSearch } from '../src/utils/search-query-expansion';

describe('authority knowledge browsing', () => {
  it('filters source language independently of translated presentation', () => {
    expect(matchesAuthoritySourceLanguage('en', 'zh')).toBe(false);
    expect(matchesAuthoritySourceLanguage('zh', 'zh')).toBe(true);
    expect(matchesAuthoritySourceLanguage(undefined, 'zh')).toBe(false);
    expect(matchesAuthoritySourceLanguage('en', undefined)).toBe(true);
  });
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

  it('puts family guidance before professional protocols and regulatory notices', () => {
    const family = authorityBrowsePriority('https://www.acog.org/womens-health/faqs/morning-sickness', '孕期');
    const professional = authorityBrowsePriority('https://www.acog.org/clinical/clinical-guidance/practice-bulletin/articles/fetal-growth', '孕期');
    const committee = authorityBrowsePriority('https://www.who.int/maternal_child_adolescent/documents/guidelines-review-committee', '孕期');
    const legacyReference = authorityBrowsePriority('http://www.who.int/maternal_child_adolescent/documents/adolescent-health-recommendations/en/', '孕期');
    expect(family).toBeLessThan(professional);
    expect(family).toBeLessThan(committee);
    expect(family).toBeLessThan(legacyReference);
    expect(authorityBrowsePriority('https://www.acog.org/news/news-releases/2026/notice', '孕期')).toBeGreaterThan(family);
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

  it('prioritizes maternal and infant topics over broad gynecology and adolescent contraception', () => {
    const feeding = authorityBrowsePriority('https://www.chinacdc.cn/jkkp/yyjk/rqyy/202408/t20240825_295584.html', '喂养', '6-23月龄婴幼儿辅食喂养指南');
    const pregnancy = authorityBrowsePriority('https://www.acog.org/womens-health/faqs/morning-sickness', '孕期', 'Morning Sickness: Nausea and Vomiting of Pregnancy');
    const menopause = authorityBrowsePriority('https://www.acog.org/womens-health/experts-and-stories/perimenopause', '孕期', 'Bleeding Changes in Perimenopause');
    const teens = authorityBrowsePriority('https://www.acog.org/womens-health/experts-and-stories/ask-acog/can-teens-get-an-iud', '孕期', 'Can teens get an IUD?');
    expect(feeding).toBeLessThan(menopause);
    expect(pregnancy).toBeLessThan(teens);
  });

  it('does not share first-page responses across page sizes, sort orders or filters', () => {
    const baseline = { page: 1, pageSize: 10, sort: 'recommended' };
    const key = authorityListCacheKey(baseline);
    for (const change of [{ pageSize: 2 }, { sort: 'latest' }, { stage: 'postpartum' }, { keyword: '辅食' }, { language: 'zh' }]) {
      expect(authorityListCacheKey({ ...baseline, ...change })).not.toBe(key);
    }
    expect(authorityListCacheKey({ ...baseline, category: 'a:b', tag: 'c' }))
      .not.toBe(authorityListCacheKey({ ...baseline, category: 'a', tag: 'b:c' }));
  });

  it('recommends systematic guidance before short answers, personal stories and interactive teasers', () => {
    const guide = authorityBrowsePriority('https://www.acog.org/womens-health/faqs/healthy-eating-during-pregnancy', '孕期', 'Healthy Eating During Pregnancy');
    const brief = authorityBrowsePriority('https://www.acog.org/womens-health/experts-and-stories/ask-acog/should-i-get-the-rsv-vaccine-during-pregnancy', '孕期', 'RSV vaccine during pregnancy');
    const story = authorityBrowsePriority('https://www.acog.org/womens-health/experts-and-stories/the-latest/my-experience-having-a-baby-during-the-covid19-pandemic', '孕期', 'My experience having a baby');
    const quiz = authorityBrowsePriority('https://www.acog.org/womens-health/healthy-living/nutrition-during-pregnancy', '孕期', 'Nutrition During Pregnancy');
    expect(guide).toBeLessThan(brief);
    expect(guide).toBeLessThan(story);
    expect(guide).toBeLessThan(quiz);
  });
});

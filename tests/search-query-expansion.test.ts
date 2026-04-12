import {
  dedupeSearchQueries,
  expandSearchTerms,
  matchesExpandedSearch,
  parseSearchRewriteOutput,
} from '../src/utils/search-query-expansion';

describe('search query expansion', () => {
  it('expands common chinese maternal-child terms to english search terms', () => {
    const terms = expandSearchTerms('宝宝发烧怎么办');

    expect(terms).toContain('baby');
    expect(terms).toContain('infant');
    expect(terms).toContain('fever');
  });

  it('matches english authority text from chinese childcare query', () => {
    expect(matchesExpandedSearch('宝宝发烧', 'fever in infants and children')).toBe(true);
  });

  it('matches peer related english titles from chinese query', () => {
    expect(matchesExpandedSearch('同伴问题', 'Problems With Peers: How to Help Your Child Navigate Social Challenges')).toBe(true);
  });

  it('matches pregnancy symptom terms against english authority content', () => {
    expect(matchesExpandedSearch('孕吐怎么办', 'Morning sickness and nausea during early pregnancy')).toBe(true);
  });

  it('matches glucose screening terms against english authority content', () => {
    expect(matchesExpandedSearch('糖耐什么时候做', 'Oral glucose tolerance test screening in pregnancy')).toBe(true);
  });

  it('expands postpartum bleeding terms to english authority search phrases', () => {
    const terms = expandSearchTerms('产后出血怎么办');

    expect(terms).toContain('postpartum');
    expect(terms).toContain('postpartum hemorrhage');
  });

  it('expands baby fever terms to english authority search phrases', () => {
    const terms = expandSearchTerms('宝宝发烧怎么办');

    expect(terms).toContain('baby fever');
    expect(terms).toContain('fever in infants');
  });

  it('parses rewrite output and dedupes normalized queries', () => {
    const parsed = parseSearchRewriteOutput('["fever in infants", "baby fever care", "fever in infants"]');
    expect(dedupeSearchQueries('宝宝发烧怎么办', parsed)).toEqual([
      '宝宝发烧怎么办',
      'fever in infants',
      'baby fever care',
    ]);
  });
});

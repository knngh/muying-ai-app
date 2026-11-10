import { shouldFilterAuthoritySourceUrl } from '../src/utils/authority-source-url';

test.each(['', 'labor-and-delivery', 'getting-pregnant', 'after-pregnancy', 'during-pregnancy'])('does not publish the ACOG pregnancy resource directory %s as a medical article', page => {
  expect(shouldFilterAuthoritySourceUrl({ source_id: 'acog', source_url: `https://www.acog.org/womens-health/pregnancy/${page}` })).toBe(true);
});
test('keeps a detailed ACOG pregnancy FAQ eligible for content quality review', () => {
  expect(shouldFilterAuthoritySourceUrl({ source_id: 'acog', source_url: 'https://www.acog.org/womens-health/faqs/healthy-eating-during-pregnancy' })).toBe(false);
});

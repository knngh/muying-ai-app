import { getAuthorityKnowledgeDropReason } from '../src/utils/knowledge-content-guard';

const article = {
  source_id: 'acog', source_url: 'https://www.acog.org/womens-health/experts-and-stories/ask-acog/why-does-my-newborn-need-vitamin-k',
  source_org: 'ACOG', source_class: 'official', source_language: 'en',
  question: 'Why does my newborn need vitamin K?',
  answer: 'Newborns have low vitamin K levels at birth, and a vitamin K shot helps prevent a rare but serious bleeding problem. Blood needs vitamin K to clot after a cut or injury. The vitamin K shot helps protect against a rare but severe bleeding disorder that can cause permanent brain injury. You can find more information about vitamin K shots for newborns at HealthyChildren.org.',
};

test('keeps a complete short official Ask ACOG medical answer after removing page navigation', () => {
  expect(getAuthorityKnowledgeDropReason(article)).toBeNull();
});
test.each([
  { source_url: 'https://www.acog.org/womens-health/topics/newborn' },
  { source_url: 'https://www.acog.org.evil.example/womens-health/experts-and-stories/ask-acog/example' },
  { source_id: 'other' },
  { answer: 'Browse all questions about pregnancy.' },
])('still filters incomplete or unrelated short authority content: %j', change => {
  expect(getAuthorityKnowledgeDropReason({ ...article, ...change })).toBe('english_authority_short_content');
});

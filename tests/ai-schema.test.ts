import {
  askQuestionBody,
  chatBody,
  conversationIdParam,
  conversationsQuery,
  searchKnowledgeQuery,
} from '../src/schemas/ai.schema';

describe('AI schemas', () => {
  it('bounds conversation pagination and knowledge search limit', () => {
    expect(conversationsQuery.parse({ page: '2', pageSize: '50' })).toEqual({ page: 2, pageSize: 50 });
    expect(conversationsQuery.safeParse({ pageSize: '0' }).success).toBe(false);
    expect(conversationsQuery.safeParse({ pageSize: '51' }).success).toBe(false);

    expect(searchKnowledgeQuery.parse({ q: '母乳喂养', limit: '20' })).toEqual({ q: '母乳喂养', limit: 20 });
    expect(searchKnowledgeQuery.safeParse({ q: '   ' }).success).toBe(false);
    expect(searchKnowledgeQuery.safeParse({ q: '母乳喂养', limit: '0' }).success).toBe(false);
  });

  it('rejects malformed conversation ids before database lookups', () => {
    expect(conversationIdParam.parse({ conversationId: '123' })).toEqual({ conversationId: '123' });
    expect(conversationIdParam.safeParse({ conversationId: 'abc' }).success).toBe(false);
    expect(conversationIdParam.safeParse({ conversationId: '1 OR 1=1' }).success).toBe(false);
  });

  it('uses the same conversation id guard for ask and chat bodies', () => {
    expect(askQuestionBody.safeParse({ question: '宝宝发热怎么办？', conversationId: 'abc' }).success).toBe(false);
    expect(chatBody.safeParse({
      messages: [{ role: 'user', content: '宝宝发热怎么办？' }],
      conversationId: '123',
    }).success).toBe(true);
  });
});

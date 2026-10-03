import { askJevChoices } from '../src/services/typesafe.service';

const questions = {
  category: { instructions: 'Classify this expense.', options: { feeding: 'Milk', supplies: 'Diapers', unknown: 'Other or unclear' } },
};
const valid = () => ({
  model: 'jev-1.13.0',
  answers: { category: { type: 'choice', choice: 'feeding', confidence: 0.97, probabilities: { feeding: 0.98, supplies: 0.01, unknown: 0.01 } } },
  usage: { input_tokens: 100, output_tokens: 20 },
});

describe('Jev closed-choice adapter', () => {
  const originalKey = process.env.TYPESAFE_API_KEY;
  const originalModel = process.env.TYPESAFE_MODEL;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    process.env.TYPESAFE_API_KEY = 'test-key';
    process.env.TYPESAFE_MODEL = 'jev-1.13.0';
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    fetchMock.mockRestore();
    if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.TYPESAFE_MODEL;
    else process.env.TYPESAFE_MODEL = originalModel;
  });

  it('uses the native System One protocol and preserves probabilities for review', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(valid()), { status: 200 }));
    const result = await askJevChoices('奶粉 268 元', questions);
    expect(result.answers.category.choice).toBe('feeding');
    expect(result.answers.category.probabilities.feeding).toBe(0.98);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(init.redirect).toBe('error');
    expect(JSON.parse(init.body)).toEqual({
      model: 'jev-1.13.0', state: '奶粉 268 元',
      questions: { category: { type: 'choice', instructions: questions.category.instructions, criteria: questions.category.options } },
    });
  });

  it('fails locally when credentials or inputs are missing', async () => {
    delete process.env.TYPESAFE_API_KEY;
    await expect(askJevChoices('text', questions)).rejects.toMatchObject({ code: 'CONFIGURATION' });
    process.env.TYPESAFE_API_KEY = 'test-key';
    await expect(askJevChoices('', questions)).rejects.toMatchObject({ code: 'INPUT' });
    await expect(askJevChoices('text', {})).rejects.toMatchObject({ code: 'INPUT' });
    await expect(askJevChoices('a'.repeat(16001), questions)).rejects.toMatchObject({ code: 'INPUT' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 429, 529])('returns a sanitized HTTP %s error with no provider body or credential', async status => {
    fetchMock.mockResolvedValue(new Response('private input test-key', { status }));
    await expect(askJevChoices('text', questions)).rejects.toMatchObject({ code: 'HTTP', status, message: `TypeSafe request failed (HTTP ${status})` });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sanitizes network failures and timeouts', async () => {
    fetchMock.mockRejectedValue(new Error('private input test-key'));
    await expect(askJevChoices('text', questions)).rejects.toMatchObject({ code: 'NETWORK', message: 'TypeSafe connection failed' });
    fetchMock.mockRejectedValue(new DOMException('private input', 'TimeoutError'));
    await expect(askJevChoices('text', questions)).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('rejects out-of-set choices, incomplete distributions and wrong question IDs', async () => {
    const unknownChoice = valid(); unknownChoice.answers.category.choice = 'invented';
    const wrongSum = valid(); wrongSum.answers.category.probabilities.feeding = 0.5;
    for (const payload of [unknownChoice, wrongSum, { ...valid(), answers: {} }, {
      ...valid(), answers: { category: { ...valid().answers.category, probabilities: { feeding: 1 } } },
    }]) {
      fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
      await expect(askJevChoices('text', questions)).rejects.toMatchObject({ code: 'RESPONSE' });
    }
  });

  it('rejects malformed JSON and confidence outside the official range', async () => {
    fetchMock.mockResolvedValue(new Response('not JSON', { status: 200 }));
    await expect(askJevChoices('text', questions)).rejects.toMatchObject({ code: 'RESPONSE' });
    const payload = valid(); payload.answers.category.confidence = 1.1;
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    await expect(askJevChoices('text', questions)).rejects.toMatchObject({ code: 'RESPONSE' });
  });
});

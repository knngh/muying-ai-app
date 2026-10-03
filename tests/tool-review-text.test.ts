import { callToolReviewText } from '../src/services/tool-review-text.service';

const previousKey = process.env.TOOL_REVIEW_GLM_API_KEY;
const messages = [{ role: 'user' as const, content: '合成记录样本' }];
let fetchMock: jest.SpyInstance;
beforeEach(() => { process.env.TOOL_REVIEW_GLM_API_KEY = 'test-only-key'; fetchMock = jest.spyOn(globalThis, 'fetch'); });
afterEach(() => {
  fetchMock.mockRestore();
  if (previousKey === undefined) delete process.env.TOOL_REVIEW_GLM_API_KEY;
  else process.env.TOOL_REVIEW_GLM_API_KEY = previousKey;
});

it('uses only the official GLM-5.3 endpoint with bounded, non-streaming JSON output', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"summary":"已整理"}' } }] })));
  const result = await callToolReviewText(messages);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions');
  expect(options.redirect).toBe('error');
  expect(options.signal).toBeInstanceOf(AbortSignal);
  expect(JSON.parse(options.body)).toMatchObject({ model: 'glm-5.3', reasoning_effort: 'low', response_format: { type: 'json_object' }, stream: false });
  expect(result.route).toEqual({ provider: 'zhipu', model: 'glm-5.3' });
});

it('does not use the general gateway key when its dedicated key is absent', async () => {
  delete process.env.TOOL_REVIEW_GLM_API_KEY;
  await expect(callToolReviewText(messages)).rejects.toThrow('not configured');
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([401, 429, 500])('does not retry or expose upstream bodies on HTTP %s', async status => {
  fetchMock.mockResolvedValue(new Response('test-only-key private record', { status }));
  await expect(callToolReviewText(messages)).rejects.toThrow('Tool review text provider unavailable');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('sanitizes timeouts and network errors', async () => {
  fetchMock.mockRejectedValue(new DOMException('test-only-key', 'TimeoutError'));
  await expect(callToolReviewText(messages)).rejects.toThrow('Tool review text provider unavailable');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each(['invalid JSON', '{}', '{"choices":[{"message":{"content":""}}]}'])('rejects malformed provider output', async payload => {
  fetchMock.mockResolvedValue(new Response(payload));
  await expect(callToolReviewText(messages)).rejects.toThrow('Tool review text provider unavailable');
});

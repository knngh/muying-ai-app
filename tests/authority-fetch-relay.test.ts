import { handleAuthorityFetch, isAllowedAuthorityFetchUrl } from '../shared/utils/authority-fetch';
import { fetchAuthorityViaRelay } from '../src/services/authority-fetch-relay.service';

const token = 'test-crawler-transport-token-with-32-characters';
const url = 'https://www.cdc.gov/pregnancy/about/index.html';
const request = (input = url, secret = token) => new Request('https://hibeihu.com/api/internal/authority-fetch', {
  method: 'POST', headers: { Authorization: `Bearer ${secret}` }, body: JSON.stringify({ url: input, headers: { 'If-None-Match': '"etag"', Authorization: 'must-not-forward' } }),
});

afterEach(() => { jest.restoreAllMocks(); delete process.env.AUTHORITY_FETCH_RELAY_URL; delete process.env.AUTHORITY_FETCH_RELAY_TOKEN; });

it('requires a backend credential before parsing or fetching anything', async () => {
  const origin = jest.fn();
  expect((await handleAuthorityFetch(request(url, 'wrong'), token, origin)).status).toBe(404);
  expect((await handleAuthorityFetch(request(), undefined, origin)).status).toBe(404);
  expect(origin).not.toHaveBeenCalled();
});

it.each(['http://www.cdc.gov/a.html', 'https://www.cdc.gov.evil.test/a.html', 'https://localhost/a.html', 'https://127.0.0.1/a.html', 'https://www.cdc.gov:8443/a.html', 'https://user:pass@www.cdc.gov/a.html', 'https://www.cdc.gov/a.html?url=https://evil.test', 'https://www.cdc.gov/a%2fsecret.html'])('rejects URLs outside the narrow origin contract: %s', async value => {
  expect(isAllowedAuthorityFetchUrl(value)).toBe(false);
  const origin = jest.fn();
  expect((await handleAuthorityFetch(request(value), token, origin)).status).toBe(400);
  expect(origin).not.toHaveBeenCalled();
});

it('returns source HTML as JSON, preserving status and validators without forwarding secrets', async () => {
  const origin = jest.fn().mockResolvedValue(new Response('<main>Original clinical content</main>', { status: 200, headers: { 'content-type': 'text/html', ETag: '"current"', 'Set-Cookie': 'private' } }));
  const response = await handleAuthorityFetch(request(), token, origin);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ status: 200, headers: { 'content-type': 'text/html', etag: '"current"' }, body: '<main>Original clinical content</main>' });
  const headers = origin.mock.calls[0][1].headers as Headers;
  expect(headers.get('Authorization')).toBeNull();
  expect(headers.get('If-None-Match')).toBe('"etag"');
});

it('allows FDA maternal health article paths but rejects unrelated FDA resources', async () => {
  const url = 'https://www.fda.gov/consumers/womens-health-topics/medicine-and-pregnancy';
  expect(isAllowedAuthorityFetchUrl(url)).toBe(true);
  expect(isAllowedAuthorityFetchUrl('https://www.fda.gov/food/people-risk-foodborne-illness/food-safety-moms-be')).toBe(true);
  expect(isAllowedAuthorityFetchUrl('https://www.fda.gov/about-fda/contact-fda')).toBe(false);
  process.env.AUTHORITY_FETCH_RELAY_URL = 'https://hibeihu.com/api/internal/authority-fetch';
  process.env.AUTHORITY_FETCH_RELAY_TOKEN = token;
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ status: 200, headers: {}, body: 'Pregnancy guidance' }));
  expect(await (await fetchAuthorityViaRelay(url))?.text()).toBe('Pregnancy guidance');
});

it('rejects redirects that leave CDC and bounds the fetched body size', async () => {
  const origin = jest.fn().mockResolvedValue(new Response(null, { status: 302, headers: { Location: 'https://evil.test/a.html' } }));
  expect((await handleAuthorityFetch(request(), token, origin)).status).toBe(502);
  expect(origin).toHaveBeenCalledTimes(1);
  origin.mockResolvedValue(new Response('too large', { headers: { 'Content-Length': String(5 * 1024 * 1024) } }));
  expect((await handleAuthorityFetch(request(), token, origin)).status).toBe(502);
});

it('preserves denials and 304 responses instead of reporting a successful origin fetch', async () => {
  process.env.AUTHORITY_FETCH_RELAY_URL = 'https://hibeihu.com/api/internal/authority-fetch';
  process.env.AUTHORITY_FETCH_RELAY_TOKEN = token;
  const mock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ status: 403, headers: {}, body: 'Access denied' }));
  expect((await fetchAuthorityViaRelay(url))?.status).toBe(403);
  mock.mockResolvedValue(Response.json({ status: 304, headers: { etag: '"same"' }, body: '' }));
  const response = await fetchAuthorityViaRelay(url);
  expect(response?.status).toBe(304);
  expect(await response?.text()).toBe('');
  expect(await fetchAuthorityViaRelay('https://evil.test/a.html')).toBeNull();
  expect(mock).toHaveBeenCalledTimes(2);
});

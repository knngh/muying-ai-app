/** Private crawler transport. Neither credentials nor arbitrary URLs reach an origin. */
export interface AuthorityFetchPayload {
  status: number;
  headers: Record<string, string>;
  body: string;
}

const MAX_BODY_BYTES = 4 * 1024 * 1024;

export function isAllowedAuthorityFetchUrl(input: string): boolean {
  try {
    const url = new URL(input);
    const allowedPath = url.hostname === 'www.cdc.gov' ? /\.(?:html|xml)$/i.test(url.pathname)
      : url.hostname === 'www.fda.gov' && /^\/(?:consumers\/womens-health-topics|food\/people-risk-foodborne-illness|drugs|medical-devices)\/[a-z0-9/-]+$/i.test(url.pathname);
    return url.protocol === 'https:' && allowedPath
      && !url.username && !url.password && !url.port && !url.search && !url.hash
      && !/%(?:2f|5c|00)/i.test(url.pathname);
  } catch { return false; }
}

export async function handleAuthorityFetch(
  request: Request,
  token: string | undefined,
  fetchOrigin: typeof fetch = fetch,
): Promise<Response> {
  const reply = (body: unknown, status: number) => Response.json(body, {
    status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
  if (!token || token.length < 32 || request.headers.get('Authorization') !== `Bearer ${token}`) {
    return reply({ error: 'Not found' }, 404);
  }
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  if (Number(request.headers.get('content-length') || 0) > 8192) return reply({ error: 'Request too large' }, 413);
  let input: { url?: unknown; headers?: unknown };
  try {
    const text = await request.text();
    if (text.length > 8192) return reply({ error: 'Request too large' }, 413);
    input = JSON.parse(text);
  } catch { return reply({ error: 'Invalid request' }, 400); }
  if (!input || typeof input.url !== 'string' || !isAllowedAuthorityFetchUrl(input.url)) {
    return reply({ error: 'URL not allowed' }, 400);
  }
  const headers = new Headers({
    Accept: 'text/html,application/xml,text/xml;q=0.9,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (compatible; BeihuAuthorityReader/1.0)',
    'Accept-Language': 'en-US,en;q=0.9',
  });
  if (input.headers && typeof input.headers === 'object') {
    for (const key of ['If-None-Match', 'If-Modified-Since']) {
      const value = (input.headers as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.length <= 512 && !/[\r\n]/u.test(value)) headers.set(key, value);
    }
  }
  let url = input.url;
  try {
    for (let redirect = 0; redirect <= 4; redirect += 1) {
      const response = await fetchOrigin(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(20000) });
      if (response.status >= 300 && response.status < 400 && response.status !== 304) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirect === 4) return reply({ error: 'Redirect unavailable' }, 502);
        url = new URL(location, url).toString();
        if (!isAllowedAuthorityFetchUrl(url) || new URL(url).hostname !== new URL(input.url).hostname) {
          return reply({ error: 'Redirect not allowed' }, 502);
        }
        continue;
      }
      if (Number(response.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
        await response.body?.cancel();
        return reply({ error: 'Origin response too large' }, 502);
      }
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      if (reader) {
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          bytes += next.value.byteLength;
          if (bytes > MAX_BODY_BYTES) {
            await reader.cancel();
            return reply({ error: 'Origin response too large' }, 502);
          }
          chunks.push(next.value);
        }
      }
      const body = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      const outputHeaders: Record<string, string> = {};
      for (const key of ['content-type', 'etag', 'last-modified']) {
        const value = response.headers.get(key);
        if (value) outputHeaders[key] = value;
      }
      const payload: AuthorityFetchPayload = { status: response.status, headers: outputHeaders, body: new TextDecoder().decode(body) };
      return reply(payload, 200);
    }
  } catch { return reply({ error: 'Origin unavailable' }, 502); }
  return reply({ error: 'Origin unavailable' }, 502);
}

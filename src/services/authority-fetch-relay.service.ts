/** Uses our existing edge transport when an allowed publisher denies server egress. */
export async function fetchAuthorityViaRelay(
  url: string,
  conditionalHeaders?: Record<string, string>,
): Promise<Response | null> {
  const endpoint = process.env.AUTHORITY_FETCH_RELAY_URL;
  const token = process.env.AUTHORITY_FETCH_RELAY_TOKEN;
  if (!endpoint || !token) return null;
  try {
    const target = new URL(url);
    const relay = new URL(endpoint);
    if (target.protocol !== 'https:' || !['www.cdc.gov', 'www.fda.gov'].includes(target.hostname)
      || target.username || target.password || target.port || target.search || target.hash
      || relay.protocol !== 'https:') return null;
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url, headers: conditionalHeaders }), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { status?: unknown; headers?: unknown; body?: unknown };
    if (!Number.isInteger(payload.status) || typeof payload.status !== 'number'
      || payload.status < 200 || payload.status > 599 || typeof payload.body !== 'string'
      || payload.body.length > 4 * 1024 * 1024 || !payload.headers || typeof payload.headers !== 'object') return null;
    const headers = new Headers();
    for (const key of ['content-type', 'etag', 'last-modified']) {
      const value = (payload.headers as Record<string, unknown>)[key];
      if (typeof value === 'string') headers.set(key, value);
    }
    return new Response([204, 205, 304].includes(payload.status) ? null : payload.body, { status: payload.status, headers });
  } catch { return null; }
}

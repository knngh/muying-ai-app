describe('vector embedding timeout guard', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      EMBEDDING_API_KEY: 'test-embedding-key',
      EMBEDDING_API_URL: 'https://embedding.example.test/v1',
      EMBEDDING_MODEL: 'test-embedding-model',
      EMBEDDING_DIM: '3',
      EMBEDDING_REQUEST_DELAY_MS: '0',
      EMBEDDING_RETRY_429_DELAY_MS: '0',
      EMBEDDING_TIMEOUT_MS: '5000',
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    process.env = originalEnv;
  });

  function embeddingResponse() {
    return new Response(JSON.stringify({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('sends embedding requests with an abort signal', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(embeddingResponse());
    let moduleApi: Pick<typeof import('../src/services/vector.service'), 'getEmbedding'>;
    jest.isolateModules(() => {
      moduleApi = require('../src/services/vector.service') as typeof import('../src/services/vector.service');
    });

    await expect(moduleApi!.getEmbedding('孕期补钙')).resolves.toEqual([0.1, 0.2, 0.3]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://embedding.example.test/v1/embeddings');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'test-embedding-model',
      input: '孕期补钙',
    });
  });

  it('retries transient embedding timeouts before failing the publish step', async () => {
    process.env.EMBEDDING_RETRY_429_LIMIT = '1';
    const timeoutError = Object.assign(new Error('request timed out'), { name: 'TimeoutError' });
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(embeddingResponse());
    let moduleApi: Pick<typeof import('../src/services/vector.service'), 'getEmbedding'>;
    jest.isolateModules(() => {
      moduleApi = require('../src/services/vector.service') as typeof import('../src/services/vector.service');
    });

    await expect(moduleApi!.getEmbedding('产后恢复')).resolves.toEqual([0.1, 0.2, 0.3]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

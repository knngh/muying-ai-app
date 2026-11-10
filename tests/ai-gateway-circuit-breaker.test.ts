describe('AI gateway provider circuit breaker', () => {
  const originalEnv = {
    AI_GATEWAY_KEY: process.env.AI_GATEWAY_KEY,
    AI_MINIMAX_KEY: process.env.AI_MINIMAX_KEY,
    AI_MINIMAX_URL: process.env.AI_MINIMAX_URL,
    AI_MINIMAX_MODEL: process.env.AI_MINIMAX_MODEL,
    AI_MINIMAX_PROVIDER: process.env.AI_MINIMAX_PROVIDER,
    AI_KIMI_KEY: process.env.AI_KIMI_KEY,
    AI_KIMI_URL: process.env.AI_KIMI_URL,
    AI_KIMI_MODEL: process.env.AI_KIMI_MODEL,
    AI_KIMI_PROVIDER: process.env.AI_KIMI_PROVIDER,
    AI_PROVIDER_USAGE_LIMIT_BLOCK_MS: process.env.AI_PROVIDER_USAGE_LIMIT_BLOCK_MS,
    AI_KNOWLEDGE_FORMAT_URL: process.env.AI_KNOWLEDGE_FORMAT_URL,
    AI_KNOWLEDGE_FORMAT_KEY: process.env.AI_KNOWLEDGE_FORMAT_KEY,
    AI_KNOWLEDGE_FORMAT_PROVIDER: process.env.AI_KNOWLEDGE_FORMAT_PROVIDER,
    AI_KNOWLEDGE_FORMAT_MODEL: process.env.AI_KNOWLEDGE_FORMAT_MODEL,
  };

  function restoreEnv() {
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-15T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    jest.restoreAllMocks();
    restoreEnv();
  });

  it('blocks shared MiniMax task providers after a usage-limit 429', async () => {
    process.env.AI_GATEWAY_KEY = '';
    process.env.AI_MINIMAX_KEY = 'minimax-key';
    process.env.AI_MINIMAX_URL = 'https://api.minimaxi.com/v1';
    process.env.AI_MINIMAX_MODEL = 'MiniMax-M2.7';
    process.env.AI_MINIMAX_PROVIDER = 'minimax';
    process.env.AI_KIMI_KEY = 'minimax-key';
    process.env.AI_KIMI_URL = 'https://api.minimaxi.com/v1';
    process.env.AI_KIMI_MODEL = 'MiniMax-M2.7';
    process.env.AI_KIMI_PROVIDER = 'minimax';
    process.env.AI_PROVIDER_USAGE_LIMIT_BLOCK_MS = '600000';

    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({
        type: 'error',
        error: {
          type: 'rate_limit_error',
          message: 'usage limit exceeded (2056)',
          http_code: '429',
        },
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    ));

    let moduleApi: Pick<
      typeof import('../src/services/ai-gateway.service'),
      'callTaskModelDetailed' | 'getAIGatewayProviderCircuitBreakerStatus'
    >;
    jest.isolateModules(() => {
      const aiGateway = require('../src/services/ai-gateway.service') as typeof import('../src/services/ai-gateway.service');
      moduleApi = {
        callTaskModelDetailed: aiGateway.callTaskModelDetailed,
        getAIGatewayProviderCircuitBreakerStatus: aiGateway.getAIGatewayProviderCircuitBreakerStatus,
      };
    });

    await expect(moduleApi!.callTaskModelDetailed('minimax_render', [
      { role: 'user', content: 'ping' },
    ], {
      primaryOnly: true,
    })).rejects.toMatchObject({
      gatewayStatus: 429,
      gatewayProvider: 'minimax',
    });

    await expect(moduleApi!.callTaskModelDetailed('kimi_reason', [
      { role: 'user', content: 'ping' },
    ], {
      primaryOnly: true,
    })).rejects.toThrow(/temporarily blocked/i);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(moduleApi!.getAIGatewayProviderCircuitBreakerStatus()).toEqual([
      expect.objectContaining({
        provider: 'minimax',
        model: 'MiniMax-M2.7',
        reason: 'usage_limit',
        blockedUntil: '2026-05-15T00:10:00.000Z',
      }),
    ]);
  });

  it('shares freellm cooldown across translation, review and layout and resumes at retryAtMs', async () => {
    process.env.AI_KNOWLEDGE_FORMAT_URL = 'https://freellm.example/v1';
    process.env.AI_KNOWLEDGE_FORMAT_KEY = 'offline-key';
    process.env.AI_KNOWLEDGE_FORMAT_PROVIDER = 'freellm';
    process.env.AI_KNOWLEDGE_FORMAT_MODEL = 'mistral-large-3';
    const retryAtMs = Date.now() + 5000;
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
      error: { message: 'All models exhausted: all routes rate-limited or on cooldown.', type: 'rate_limit_error', retryAtMs },
    }, { status: 429 })).mockImplementation(async () => Response.json({ choices: [{ message: { content: 'ok' } }] }));
    const gateway = require('../src/services/ai-gateway.service') as typeof import('../src/services/ai-gateway.service');
    const options = { primaryOnly: true };
    await expect(gateway.callTaskModelDetailed('knowledge_translate', [{ role: 'user', content: 'ping' }], options)).rejects.toThrow();
    for (const role of ['knowledge_review', 'knowledge_format'] as const) {
      await expect(gateway.callTaskModelDetailed(role, [{ role: 'user', content: 'ping' }], options)).rejects.toThrow(/temporarily blocked/);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(gateway.getAIGatewayProviderCircuitBreakerStatus()[0].blockedUntil).toBe(new Date(retryAtMs).toISOString());
    jest.setSystemTime(retryAtMs + 1);
    await expect(gateway.callTaskModelDetailed('knowledge_review', [{ role: 'user', content: 'ping' }], options)).resolves.toMatchObject({ answer: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

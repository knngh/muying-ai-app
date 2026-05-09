describe('AI gateway Modal Direct provider', () => {
  const originalEnv = {
    AI_MODAL_DIRECT_KEY: process.env.AI_MODAL_DIRECT_KEY,
    AI_GLM_KEY: process.env.AI_GLM_KEY,
    AI_GLM_URL: process.env.AI_GLM_URL,
    AI_GLM_MODEL: process.env.AI_GLM_MODEL,
    AI_GLM_PROVIDER: process.env.AI_GLM_PROVIDER,
    AI_GATEWAY_KEY: process.env.AI_GATEWAY_KEY,
    AI_OPENROUTER_KEY: process.env.AI_OPENROUTER_KEY,
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

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    restoreEnv();
  });

  it('uses Modal Direct GLM-5.1-FP8 for the GLM task binding when configured', () => {
    process.env.AI_MODAL_DIRECT_KEY = 'test-modal-key';
    delete process.env.AI_GLM_KEY;
    delete process.env.AI_GLM_URL;
    delete process.env.AI_GLM_MODEL;
    delete process.env.AI_GLM_PROVIDER;

    jest.isolateModules(() => {
      const { getTaskModelBindings } = require('../src/services/ai-gateway.service') as typeof import('../src/services/ai-gateway.service');
      const glmBinding = getTaskModelBindings().find((item) => item.role === 'glm_classify');

      expect(glmBinding).toEqual({
        role: 'glm_classify',
        model: 'zai-org/GLM-5.1-FP8',
        provider: 'modal-direct',
        configured: true,
      });
    });
  });

  it('does not fall back to legacy providers when Modal Direct is concurrency limited', async () => {
    process.env.AI_MODAL_DIRECT_KEY = 'test-modal-key';
    delete process.env.AI_GLM_KEY;
    delete process.env.AI_GLM_URL;
    delete process.env.AI_GLM_MODEL;
    delete process.env.AI_GLM_PROVIDER;
    process.env.AI_GATEWAY_KEY = 'legacy-key';
    process.env.AI_OPENROUTER_KEY = 'legacy-key';

    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'Too many concurrent requests for this model' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    ));

    let moduleApi: Pick<typeof import('../src/services/ai-gateway.service'), 'callTaskModelDetailed' | 'isAIGatewayModalDirectRateLimitError'> | null = null;
    jest.isolateModules(() => {
      const aiGateway = require('../src/services/ai-gateway.service') as typeof import('../src/services/ai-gateway.service');
      moduleApi = {
        callTaskModelDetailed: aiGateway.callTaskModelDetailed,
        isAIGatewayModalDirectRateLimitError: aiGateway.isAIGatewayModalDirectRateLimitError,
      };
    });

    expect(moduleApi).not.toBeNull();
    await expect(moduleApi.callTaskModelDetailed('glm_classify', [
      { role: 'user', content: 'ping' },
    ])).rejects.toMatchObject({
      gatewayStatus: 429,
      gatewayProvider: 'modal-direct',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('can stop task fallback after any Modal Direct provider failure', async () => {
    process.env.AI_MODAL_DIRECT_KEY = 'test-modal-key';
    delete process.env.AI_GLM_KEY;
    delete process.env.AI_GLM_URL;
    delete process.env.AI_GLM_MODEL;
    delete process.env.AI_GLM_PROVIDER;
    process.env.AI_GATEWAY_KEY = 'legacy-key';
    process.env.AI_OPENROUTER_KEY = 'legacy-key';

    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ choices: [{ message: { role: 'assistant' } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    let callTaskModelDetailed: typeof import('../src/services/ai-gateway.service').callTaskModelDetailed;
    jest.isolateModules(() => {
      const aiGateway = require('../src/services/ai-gateway.service') as typeof import('../src/services/ai-gateway.service');
      callTaskModelDetailed = aiGateway.callTaskModelDetailed;
    });

    await expect(callTaskModelDetailed('glm_classify', [
      { role: 'user', content: 'ping' },
    ], {
      stopOnProviderFailure: ['modal-direct'],
    })).rejects.toThrow('AI provider returned empty response');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

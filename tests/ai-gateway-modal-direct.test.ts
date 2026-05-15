describe('AI gateway Modal Direct provider', () => {
  const originalEnv = {
    AI_MODAL_DIRECT_KEY: process.env.AI_MODAL_DIRECT_KEY,
    AI_GLM_KEY: process.env.AI_GLM_KEY,
    AI_GLM_URL: process.env.AI_GLM_URL,
    AI_GLM_MODEL: process.env.AI_GLM_MODEL,
    AI_GLM_PROVIDER: process.env.AI_GLM_PROVIDER,
    AI_MODAL_DIRECT_MIN_COMPLETION_TOKENS: process.env.AI_MODAL_DIRECT_MIN_COMPLETION_TOKENS,
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

  it('can restrict task calls to the configured primary provider', async () => {
    delete process.env.AI_MODAL_DIRECT_KEY;
    delete process.env.AI_GLM_KEY;
    process.env.AI_GATEWAY_KEY = 'legacy-key';
    process.env.AI_OPENROUTER_KEY = 'legacy-key';

    const fetchMock = jest.spyOn(globalThis, 'fetch');

    let callTaskModelDetailed: typeof import('../src/services/ai-gateway.service').callTaskModelDetailed;
    jest.isolateModules(() => {
      const aiGateway = require('../src/services/ai-gateway.service') as typeof import('../src/services/ai-gateway.service');
      callTaskModelDetailed = aiGateway.callTaskModelDetailed;
    });

    await expect(callTaskModelDetailed('glm_classify', [
      { role: 'user', content: 'ping' },
    ], {
      primaryOnly: true,
    })).rejects.toThrow('未配置可用的任务模型: glm_classify');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reserves enough completion budget for Modal Direct reasoning models', async () => {
    process.env.AI_MODAL_DIRECT_KEY = 'test-modal-key';
    process.env.AI_MODAL_DIRECT_MIN_COMPLETION_TOKENS = '1000';
    delete process.env.AI_GLM_KEY;
    delete process.env.AI_GLM_URL;
    delete process.env.AI_GLM_MODEL;
    delete process.env.AI_GLM_PROVIDER;

    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: 'There are three r letters.',
            reasoning_content: 'reasoning omitted',
          },
          finish_reason: 'stop',
        }],
      }),
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
      maxTokens: 80,
      temperature: 0,
    })).resolves.toMatchObject({
      answer: 'There are three r letters.',
      route: {
        provider: 'modal-direct',
        model: 'zai-org/GLM-5.1-FP8',
      },
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { max_tokens?: number };
    expect(requestBody.max_tokens).toBe(1000);
  });
});

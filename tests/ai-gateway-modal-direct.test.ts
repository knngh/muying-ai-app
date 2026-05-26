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
    AI_KIMI_KEY: process.env.AI_KIMI_KEY,
    AI_KIMI_URL: process.env.AI_KIMI_URL,
    AI_KIMI_MODEL: process.env.AI_KIMI_MODEL,
    AI_KIMI_PROVIDER: process.env.AI_KIMI_PROVIDER,
    AI_DEEPSEEK_KEY: process.env.AI_DEEPSEEK_KEY,
    AI_DEEPSEEK_URL: process.env.AI_DEEPSEEK_URL,
    AI_DEEPSEEK_MODEL: process.env.AI_DEEPSEEK_MODEL,
    AI_DEEPSEEK_PROVIDER: process.env.AI_DEEPSEEK_PROVIDER,
    AI_TASK_TRANSIENT_RETRY_ATTEMPTS: process.env.AI_TASK_TRANSIENT_RETRY_ATTEMPTS,
    AI_TASK_TRANSIENT_RETRY_DELAY_MS: process.env.AI_TASK_TRANSIENT_RETRY_DELAY_MS,
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

  it('uses OpenRouter free router for the Kimi task binding when configured', () => {
    process.env.AI_KIMI_KEY = 'test-openrouter-key';
    process.env.AI_KIMI_URL = 'https://openrouter.ai/api/v1';
    process.env.AI_KIMI_MODEL = 'openrouter/free';
    process.env.AI_KIMI_PROVIDER = 'openrouter';

    jest.isolateModules(() => {
      const { getTaskModelBindings } = require('../src/services/ai-gateway.service') as typeof import('../src/services/ai-gateway.service');
      const kimiBinding = getTaskModelBindings().find((item) => item.role === 'kimi_reason');

      expect(kimiBinding).toEqual({
        role: 'kimi_reason',
        model: 'openrouter/free',
        provider: 'openrouter',
        configured: true,
      });
    });
  });

  it('uses official DeepSeek V4 Flash for the translation task binding when configured', () => {
    process.env.AI_DEEPSEEK_KEY = 'test-deepseek-key';
    delete process.env.AI_DEEPSEEK_URL;
    delete process.env.AI_DEEPSEEK_MODEL;
    delete process.env.AI_DEEPSEEK_PROVIDER;

    jest.isolateModules(() => {
      const { getTaskModelBindings } = require('../src/services/ai-gateway.service') as typeof import('../src/services/ai-gateway.service');
      const deepseekBinding = getTaskModelBindings().find((item) => item.role === 'deepseek_translate');

      expect(deepseekBinding).toEqual({
        role: 'deepseek_translate',
        model: 'deepseek-v4-flash',
        provider: 'deepseek',
        configured: true,
      });
    });
  });

  it('sends DeepSeek translation task calls with JSON output and non-thinking mode', async () => {
    process.env.AI_DEEPSEEK_KEY = 'test-deepseek-key';

    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: '{"translated_title":"母乳喂养","translated_summary":"摘要","translated_content":"正文"}',
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

    await expect(callTaskModelDetailed('deepseek_translate', [
      { role: 'user', content: 'translate' },
    ], {
      primaryOnly: true,
      responseFormat: 'json_object',
      thinking: 'disabled',
    })).resolves.toMatchObject({
      answer: '{"translated_title":"母乳喂养","translated_summary":"摘要","translated_content":"正文"}',
      route: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
      },
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.deepseek.com/chat/completions');
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      model?: string;
      response_format?: { type?: string };
      thinking?: { type?: string };
    };
    expect(requestBody.model).toBe('deepseek-v4-flash');
    expect(requestBody.response_format).toEqual({ type: 'json_object' });
    expect(requestBody.thinking).toEqual({ type: 'disabled' });
  });

  it('retries transient DeepSeek task provider failures before falling back', async () => {
    process.env.AI_DEEPSEEK_KEY = 'test-deepseek-key';
    process.env.AI_TASK_TRANSIENT_RETRY_ATTEMPTS = '1';
    process.env.AI_TASK_TRANSIENT_RETRY_DELAY_MS = '0';

    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          error: {
            message: 'Service is too busy. We advise users to temporarily switch to alternative LLM API service providers.',
            type: 'service_unavailable_error',
            code: 'service_unavailable_error',
          },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              content: '{"translated_title":"母乳喂养"}',
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

    await expect(callTaskModelDetailed('deepseek_translate', [
      { role: 'user', content: 'translate' },
    ], {
      primaryOnly: true,
      responseFormat: 'json_object',
    })).resolves.toMatchObject({
      answer: '{"translated_title":"母乳喂养"}',
      route: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries an empty DeepSeek task response before falling back', async () => {
    process.env.AI_DEEPSEEK_KEY = 'test-deepseek-key';
    process.env.AI_TASK_TRANSIENT_RETRY_ATTEMPTS = '1';
    process.env.AI_TASK_TRANSIENT_RETRY_DELAY_MS = '0';

    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          choices: [{
            message: { role: 'assistant' },
            finish_reason: 'stop',
          }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              content: '{"translated_title":"母乳喂养"}',
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

    await expect(callTaskModelDetailed('deepseek_translate', [
      { role: 'user', content: 'translate' },
    ], {
      primaryOnly: true,
      responseFormat: 'json_object',
    })).resolves.toMatchObject({
      answer: '{"translated_title":"母乳喂养"}',
      route: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends Kimi task calls to the OpenRouter free router model', async () => {
    process.env.AI_KIMI_KEY = 'test-openrouter-key';
    process.env.AI_KIMI_URL = 'https://openrouter.ai/api/v1';
    process.env.AI_KIMI_MODEL = 'openrouter/free';
    process.env.AI_KIMI_PROVIDER = 'openrouter';

    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: 'translated',
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

    await expect(callTaskModelDetailed('kimi_reason', [
      { role: 'user', content: 'translate' },
    ], {
      primaryOnly: true,
    })).resolves.toMatchObject({
      answer: 'translated',
      route: {
        provider: 'openrouter',
        model: 'openrouter/free',
      },
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { model?: string };
    expect(requestBody.model).toBe('openrouter/free');
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
    process.env.AI_TASK_TRANSIENT_RETRY_ATTEMPTS = '0';
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

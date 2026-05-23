import {
  buildAIProviderHealthReport,
  buildAIProviderHealthSuiteReport,
} from '../src/utils/ai-provider-health';

describe('AI provider health report', () => {
  it('uses a short operational timeout by default', async () => {
    const callTaskModel = jest.fn().mockResolvedValue({
      answer: '3',
      route: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        route: 'task',
        label: 'task-deepseek-translation',
      },
    });

    const report = await buildAIProviderHealthReport({
      callTaskModel,
      getBindings: jest.fn().mockReturnValue([{
        role: 'deepseek_translate',
        model: 'deepseek-v4-flash',
        provider: 'deepseek',
        configured: true,
      }]),
    });

    expect(report.timeoutMs).toBe(12000);
    expect(report.taskRole).toBe('deepseek_translate');
    expect(callTaskModel).toHaveBeenCalledWith('deepseek_translate', expect.any(Array), expect.objectContaining({
      timeoutMs: 12000,
      maxTokens: 80,
    }));
  });

  it('reports ok when the task model returns the expected answer on the configured route', async () => {
    const report = await buildAIProviderHealthReport({
      taskRole: 'glm_classify',
      now: '2026-05-10T00:00:00.000Z',
      callTaskModel: jest.fn().mockResolvedValue({
        answer: '3',
        route: {
          provider: 'modal-direct',
          model: 'zai-org/GLM-5.1-FP8',
          route: 'task',
          label: 'task-glm',
        },
      }),
      getBindings: jest.fn().mockReturnValue([{
        role: 'glm_classify',
        model: 'zai-org/GLM-5.1-FP8',
        provider: 'modal-direct',
        configured: true,
      }]),
    });

    expect(report).toMatchObject({
      generatedAt: '2026-05-10T00:00:00.000Z',
      status: 'ok',
      taskRole: 'glm_classify',
      binding: {
        provider: 'modal-direct',
        model: 'zai-org/GLM-5.1-FP8',
        configured: true,
      },
      call: {
        attempted: true,
        ok: true,
        answerPreview: '3',
        expectedMatched: true,
        route: {
          provider: 'modal-direct',
          model: 'zai-org/GLM-5.1-FP8',
        },
      },
    });
  });

  it('redacts secrets from provider error messages', async () => {
    const error = new Error('AI Gateway error: 401: Authorization Bearer secret-token-123 api_key=secret-key-456') as Error & {
      gatewayStatus?: number;
      gatewayProvider?: string;
      gatewayModel?: string;
    };
    error.gatewayStatus = 401;
    error.gatewayProvider = 'modal-direct';
    error.gatewayModel = 'zai-org/GLM-5.1-FP8';

    const report = await buildAIProviderHealthReport({
      taskRole: 'glm_classify',
      callTaskModel: jest.fn().mockRejectedValue(error),
      getBindings: jest.fn().mockReturnValue([{
        role: 'glm_classify',
        model: 'zai-org/GLM-5.1-FP8',
        provider: 'modal-direct',
        configured: true,
      }]),
    });

    expect(report.status).toBe('failed');
    expect(report.call.error).toMatchObject({
      gatewayStatus: 401,
      gatewayProvider: 'modal-direct',
      gatewayModel: 'zai-org/GLM-5.1-FP8',
    });
    expect(report.call.error?.message).toContain('Bearer [redacted]');
    expect(report.call.error?.message).toContain('api_key=[redacted]');
    expect(report.call.error?.message).not.toContain('secret-token-123');
    expect(report.call.error?.message).not.toContain('secret-key-456');
  });

  it('marks transient provider 5xx failures as degraded instead of failed', async () => {
    const error = new Error('AI Gateway error: 503') as Error & {
      gatewayStatus?: number;
      gatewayProvider?: string;
      gatewayModel?: string;
    };
    error.gatewayStatus = 503;
    error.gatewayProvider = 'modal-direct';
    error.gatewayModel = 'zai-org/GLM-5.1-FP8';

    const report = await buildAIProviderHealthReport({
      taskRole: 'glm_classify',
      now: '2026-05-11T00:00:00.000Z',
      callTaskModel: jest.fn().mockRejectedValue(error),
      getBindings: jest.fn().mockReturnValue([{
        role: 'glm_classify',
        model: 'zai-org/GLM-5.1-FP8',
        provider: 'modal-direct',
        configured: true,
      }]),
    });

    expect(report).toMatchObject({
      status: 'degraded',
      call: {
        attempted: true,
        ok: false,
        error: {
          gatewayStatus: 503,
          gatewayProvider: 'modal-direct',
          gatewayModel: 'zai-org/GLM-5.1-FP8',
        },
      },
    });
  });

  it('marks configured provider health timeouts as degraded with binding metadata', async () => {
    const report = await buildAIProviderHealthReport({
      taskRole: 'glm_classify',
      now: '2026-05-11T00:00:00.000Z',
      callTaskModel: jest.fn().mockRejectedValue(new Error('AI Gateway timeout after 45000ms')),
      getBindings: jest.fn().mockReturnValue([{
        role: 'glm_classify',
        model: 'zai-org/GLM-5.1-FP8',
        provider: 'modal-direct',
        configured: true,
      }]),
    });

    expect(report).toMatchObject({
      status: 'degraded',
      call: {
        attempted: true,
        ok: false,
        error: {
          message: 'AI Gateway timeout after 45000ms',
          gatewayProvider: 'modal-direct',
          gatewayModel: 'zai-org/GLM-5.1-FP8',
        },
      },
    });
  });

  it('fails without attempting a call for unsupported task roles', async () => {
    const callTaskModel = jest.fn();
    const report = await buildAIProviderHealthReport({
      taskRole: 'unknown_role',
      callTaskModel,
      getBindings: jest.fn().mockReturnValue([]),
    });

    expect(report).toMatchObject({
      status: 'failed',
      taskRole: 'unknown_role',
      call: {
        attempted: false,
        ok: false,
      },
    });
    expect(callTaskModel).not.toHaveBeenCalled();
  });

  it('builds an aggregate health suite for primary and fallback translation routes', async () => {
    const callTaskModel = jest.fn()
      .mockResolvedValueOnce({
        answer: '3',
        route: {
          provider: 'modal-direct',
          model: 'zai-org/GLM-5.1-FP8',
          route: 'task',
          label: 'task-glm',
        },
      })
      .mockResolvedValueOnce({
        answer: '3',
        route: {
          provider: 'openrouter',
          model: 'openrouter/free',
          route: 'task',
          label: 'task-kimi',
        },
      });

    const report = await buildAIProviderHealthSuiteReport({
      now: '2026-05-19T00:00:00.000Z',
      taskRoles: ['glm_classify', 'kimi_reason'],
      callTaskModel,
      getBindings: jest.fn().mockReturnValue([
        {
          role: 'glm_classify',
          model: 'zai-org/GLM-5.1-FP8',
          provider: 'modal-direct',
          configured: true,
        },
        {
          role: 'kimi_reason',
          model: 'openrouter/free',
          provider: 'openrouter',
          configured: true,
        },
      ]),
    });

    expect(report).toMatchObject({
      generatedAt: '2026-05-19T00:00:00.000Z',
      status: 'ok',
      taskRoles: ['glm_classify', 'kimi_reason'],
      checks: [
        {
          status: 'ok',
          taskRole: 'glm_classify',
          binding: {
            provider: 'modal-direct',
            model: 'zai-org/GLM-5.1-FP8',
          },
        },
        {
          status: 'ok',
          taskRole: 'kimi_reason',
          binding: {
            provider: 'openrouter',
            model: 'openrouter/free',
          },
          call: {
            route: {
              provider: 'openrouter',
              model: 'openrouter/free',
            },
          },
        },
      ],
    });
    expect(callTaskModel).toHaveBeenNthCalledWith(1, 'glm_classify', expect.any(Array), expect.objectContaining({
      stopOnProviderFailure: ['modal-direct'],
    }));
    expect(callTaskModel).toHaveBeenNthCalledWith(2, 'kimi_reason', expect.any(Array), expect.objectContaining({
      stopOnProviderFailure: ['openrouter'],
    }));
  });
});

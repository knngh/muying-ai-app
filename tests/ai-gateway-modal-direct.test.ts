describe('AI gateway Modal Direct provider', () => {
  const originalEnv = {
    AI_MODAL_DIRECT_KEY: process.env.AI_MODAL_DIRECT_KEY,
    AI_GLM_KEY: process.env.AI_GLM_KEY,
    AI_GLM_URL: process.env.AI_GLM_URL,
    AI_GLM_MODEL: process.env.AI_GLM_MODEL,
    AI_GLM_PROVIDER: process.env.AI_GLM_PROVIDER,
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
});

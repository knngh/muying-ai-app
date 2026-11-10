describe('freellm knowledge layout task', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; jest.resetModules(); jest.restoreAllMocks(); });
  it.each(['knowledge_format', 'knowledge_translate'])('routes %s to the configured freellm provider', async (role) => {
    process.env.AI_KNOWLEDGE_FORMAT_URL = 'https://layout.example/v1';
    process.env.AI_KNOWLEDGE_FORMAT_KEY = 'test-layout-key';
    process.env.AI_KNOWLEDGE_FORMAT_MODEL = 'auto';
    process.env.AI_KNOWLEDGE_FORMAT_PROVIDER = 'freellm';
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"blocks":[]}' } }] }), { headers: { 'content-type': 'application/json' } }));
    const { callTaskModelDetailed } = require('../src/services/ai-gateway.service');
    const result = await callTaskModelDetailed(role, [{ role: 'user', content: '公开科普' }], { primaryOnly: true });
    expect(result.route.provider).toBe('freellm');
    expect(fetchMock.mock.calls[0][0]).toBe('https://layout.example/v1/chat/completions');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).model).toBe('auto');
  });
  it('never falls back to another model when the layout provider is missing', async () => {
    delete process.env.AI_KNOWLEDGE_FORMAT_KEY;
    process.env.AI_OPENROUTER_KEY = 'test-other-model';
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    const { callTaskModelDetailed } = require('../src/services/ai-gateway.service');
    await expect(callTaskModelDetailed('knowledge_format', [{ role: 'user', content: '公开科普' }])).rejects.toThrow('未配置');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

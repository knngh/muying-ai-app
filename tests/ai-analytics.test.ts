import {
  buildAIRequestAnalyticsMetadata,
  buildAIRequestErrorAnalyticsProperties,
  buildAIRequestStartAnalyticsProperties,
  buildAIResponseCompleteAnalyticsProperties,
} from '../src/utils/ai-analytics';

describe('AI server analytics helpers', () => {
  it('builds request metadata without persisting raw prompt or context values', () => {
    const question = '宝宝发热怎么办？';
    const metadata = buildAIRequestAnalyticsMetadata({
      endpoint: 'chat',
      requestId: 'req-analytics-1',
      userId: '42',
      question,
      context: {
        stage: 'newborn',
        entrySource: 'knowledge_detail',
        articleSlug: 'who-feeding-guide',
        privateNote: '家里地址和隐私备注',
      },
      model: 'zai-org/GLM-5.1-FP8',
      conversationId: '1001',
      clientRequestId: 'client-analytics-1',
      history: [
        { role: 'user', content: '上一轮问题' },
        { role: 'assistant', content: '上一轮回答' },
        { role: 'user', content: question },
      ],
      isResumeContinuation: true,
    });

    const properties = buildAIRequestStartAnalyticsProperties(metadata);
    const serialized = JSON.stringify(properties);

    expect(properties).toMatchObject({
      endpoint: 'chat',
      requestId: 'req-analytics-1',
      questionLength: question.length,
      historyCount: 3,
      userMessageCount: 2,
      assistantMessageCount: 1,
      requestedModel: 'zai-org/GLM-5.1-FP8',
      contextKind: 'object',
      entrySource: 'knowledge_detail',
      articleSlug: 'who-feeding-guide',
      stage: 'newborn',
      hasConversationId: true,
      resumeContinuation: true,
    });
    expect(properties.contextKeys).toEqual(expect.arrayContaining([
      'stage',
      'entrySource',
      'articleSlug',
      'privateNote',
    ]));
    expect(serialized).not.toContain(question);
    expect(serialized).not.toContain('家里地址和隐私备注');
  });

  it('builds response and error properties from metadata only', () => {
    const metadata = buildAIRequestAnalyticsMetadata({
      endpoint: 'ask',
      requestId: 'req-analytics-2',
      userId: '42',
      question: '黄疸什么时候需要就医？',
      context: undefined,
      model: undefined,
      conversationId: undefined,
    });

    const responseProperties = buildAIResponseCompleteAnalyticsProperties(metadata, {
      answer: '这里不能进入埋点',
      sources: [{ title: '指南 1' }, { title: '指南 2' }],
      isEmergency: false,
      triageCategory: 'caution',
      riskLevel: 'yellow',
      structuredAnswer: {
        conclusion: '',
        reasons: [],
        actions: [],
        whenToSeekCare: [],
      },
      uncertainty: { level: 'medium' },
      sourceReliability: 'authoritative',
      disclaimer: '',
      followUpQuestions: ['下一步问题'],
      confidence: 0.82,
      degraded: false,
      model: 'zai-org/GLM-5.1-FP8',
      provider: 'modal-direct',
      route: 'task:glm_classify',
    }, {
      durationMs: 1250,
      conversationPersisted: true,
    });

    const errorProperties = buildAIRequestErrorAnalyticsProperties(metadata, {
      name: 'AppError',
      code: 'AI_TIMEOUT',
      statusCode: 504,
      message: '这里也不能进入埋点',
    }, {
      durationMs: 300,
    });

    expect(responseProperties).toMatchObject({
      endpoint: 'ask',
      durationMs: 1250,
      provider: 'modal-direct',
      model: 'zai-org/GLM-5.1-FP8',
      route: 'task:glm_classify',
      riskLevel: 'yellow',
      triageCategory: 'caution',
      sourceReliability: 'authoritative',
      sourcesCount: 2,
      followUpQuestionsCount: 1,
      conversationPersisted: true,
    });
    expect(errorProperties).toMatchObject({
      endpoint: 'ask',
      durationMs: 300,
      errorName: 'AppError',
      errorCode: 'AI_TIMEOUT',
      statusCode: 504,
    });
    expect(JSON.stringify(responseProperties)).not.toContain('这里不能进入埋点');
    expect(JSON.stringify(errorProperties)).not.toContain('这里也不能进入埋点');
  });

  it('builds stream metadata with product entry attribution', () => {
    const metadata = buildAIRequestAnalyticsMetadata({
      endpoint: 'chat_stream',
      requestId: 'ws-request-1',
      userId: '42',
      question: '继续问一下',
      context: {
        entrySource: 'weekly_report',
        stage: 'second-trimester',
        reportId: 'report-123',
      },
      conversationId: '46',
      clientRequestId: 'ws-request-1',
      history: [
        { role: 'user', content: '第一轮问题' },
        { role: 'assistant', content: '第一轮回答' },
        { role: 'user', content: '继续问一下' },
      ],
    });

    expect(buildAIRequestStartAnalyticsProperties(metadata)).toMatchObject({
      endpoint: 'chat_stream',
      requestId: 'ws-request-1',
      entrySource: 'weekly_report',
      stage: 'second-trimester',
      reportId: 'report-123',
      hasConversationId: true,
      historyCount: 3,
      userMessageCount: 2,
      assistantMessageCount: 1,
    });
  });

  it('passes ops traffic kind through server AI analytics metadata', () => {
    const metadata = buildAIRequestAnalyticsMetadata({
      endpoint: 'ask',
      requestId: 'ops-request-1',
      userId: '42',
      question: '宝宝今晚怎么观察？',
      context: {
        entrySource: 'home_suggested_question',
        reportId: 'ops-ai-entrypoint-smoke-home',
        trafficKind: 'ops_product_entrypoint_smoke',
      },
      clientRequestId: 'ops-ai-entrypoint-smoke-home-1',
    });

    expect(buildAIRequestStartAnalyticsProperties(metadata)).toMatchObject({
      endpoint: 'ask',
      requestId: 'ops-request-1',
      entrySource: 'home_suggested_question',
      reportId: 'ops-ai-entrypoint-smoke-home',
      trafficKind: 'ops_product_entrypoint_smoke',
      clientRequestId: 'ops-ai-entrypoint-smoke-home-1',
    });
  });
});

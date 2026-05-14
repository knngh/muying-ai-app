import type { NextFunction, Request, Response } from 'express';
import { quotaCheckMiddleware } from '../src/middlewares/quota.middleware';
import { consumeAiQuota } from '../src/services/subscription.service';

jest.mock('../src/services/subscription.service', () => ({
  consumeAiQuota: jest.fn(),
}));

const mockedConsumeAiQuota = consumeAiQuota as jest.MockedFunction<typeof consumeAiQuota>;

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('AI quota fingerprint', () => {
  beforeEach(() => {
    mockedConsumeAiQuota.mockReset();
  });

  it('deduplicates chat and chat stream fallback with the same client request id', async () => {
    mockedConsumeAiQuota.mockResolvedValue({
      allowed: true,
      quota: {
        date: '2026-05-14',
        aiUsedToday: 1,
        aiLimit: 3,
        remainingToday: 2,
        isUnlimited: false,
      },
    });

    const body = {
      messages: [{ role: 'user', content: '宝宝低热怎么办？' }],
      conversationId: '58',
      context: { entrySource: 'native', stage: 'newborn' },
      clientRequestId: 'client-request-abc123',
    };
    const next: NextFunction = jest.fn();

    await quotaCheckMiddleware(
      { userId: 'user-1', path: '/chat/stream', body } as unknown as Request,
      createResponse(),
      next,
    );
    await quotaCheckMiddleware(
      { userId: 'user-1', path: '/chat', body } as unknown as Request,
      createResponse(),
      next,
    );

    expect(mockedConsumeAiQuota).toHaveBeenCalledTimes(2);
    expect(mockedConsumeAiQuota.mock.calls[0][1]).toEqual(mockedConsumeAiQuota.mock.calls[1][1]);
    expect(mockedConsumeAiQuota.mock.calls[0][1]).toMatchObject({
      requestId: 'client-request-abc123',
    });
  });

  it('deduplicates ask and ask stream fallback with the same client request id', async () => {
    mockedConsumeAiQuota.mockResolvedValue({
      allowed: true,
      quota: {
        date: '2026-05-14',
        aiUsedToday: 1,
        aiLimit: 3,
        remainingToday: 2,
        isUnlimited: false,
      },
    });

    const body = {
      question: '宝宝低热怎么办？',
      context: { entrySource: 'home_suggested_question', stage: 'newborn' },
      clientRequestId: 'client-request-def456',
    };
    const next: NextFunction = jest.fn();

    await quotaCheckMiddleware(
      { userId: 'user-1', path: '/ask/stream', body } as unknown as Request,
      createResponse(),
      next,
    );
    await quotaCheckMiddleware(
      { userId: 'user-1', path: '/ask', body } as unknown as Request,
      createResponse(),
      next,
    );

    expect(mockedConsumeAiQuota).toHaveBeenCalledTimes(2);
    expect(mockedConsumeAiQuota.mock.calls[0][1]).toEqual(mockedConsumeAiQuota.mock.calls[1][1]);
    expect(mockedConsumeAiQuota.mock.calls[0][1]).toMatchObject({
      requestId: 'client-request-def456',
    });
  });
});

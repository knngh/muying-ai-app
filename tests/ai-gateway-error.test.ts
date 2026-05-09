import {
  getAIGatewayErrorOpsMessage,
  isAIGatewayModalDirectRateLimitError,
} from '../src/services/ai-gateway.service';

describe('AI gateway provider errors', () => {
  it('keeps public error messages short while preserving ops details', () => {
    const error = Object.assign(new Error('AI Gateway error: 429'), {
      gatewayErrorText: 'usage limit exceeded, weekly usage limit reached, resets at 2026-05-11T00:00:00+08:00',
    });

    expect(error.message).toBe('AI Gateway error: 429');
    expect(getAIGatewayErrorOpsMessage(error)).toBe(
      'AI Gateway error: 429: usage limit exceeded, weekly usage limit reached, resets at 2026-05-11T00:00:00+08:00',
    );
  });

  it('identifies Modal Direct 429 errors as provider-local rate limits', () => {
    const modalError = Object.assign(new Error('AI Gateway error: 429'), {
      gatewayStatus: 429,
      gatewayProvider: 'modal-direct',
      gatewayErrorText: '{"error":"Too many concurrent requests for this model"}',
    });
    const legacyError = Object.assign(new Error('AI Gateway error: 429'), {
      gatewayStatus: 429,
      gatewayProvider: 'minimax',
    });

    expect(isAIGatewayModalDirectRateLimitError(modalError)).toBe(true);
    expect(isAIGatewayModalDirectRateLimitError(legacyError)).toBe(false);
  });
});

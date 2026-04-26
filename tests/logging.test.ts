import { maskSensitiveUrl } from '../src/utils/logging';

describe('logging utilities', () => {
  it('redacts sensitive query values from access log URLs', () => {
    expect(maskSensitiveUrl('/api/v1/auth/check/phone?phone=13800138000&page=1')).toBe(
      '/api/v1/auth/check/phone?phone=%5Bredacted%5D&page=1',
    );
    expect(maskSensitiveUrl('/api/v1/auth/check/username?email=user@example.com&token=abc')).toBe(
      '/api/v1/auth/check/username?email=%5Bredacted%5D&token=%5Bredacted%5D',
    );
  });

  it('keeps non-sensitive query values readable', () => {
    expect(maskSensitiveUrl('/api/v1/articles?keyword=辅食&page=2')).toBe('/api/v1/articles?keyword=%E8%BE%85%E9%A3%9F&page=2');
  });
});

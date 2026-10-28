const { audit } = require('../scripts/audit-ai-entrypoint-clients');

describe('AI entrypoint client audit', () => {
  it('keeps real client AI entrypoint telemetry wired', () => {
    const summary = audit();

    expect(summary.ok).toBe(true);
    expect(summary.failures).toEqual([]);
    expect(summary.passed).toBeGreaterThanOrEqual(11);
    expect(summary.warnings.some(({ description }) => description.includes('mini-program chat UI is still disabled'))).toBe(true);
  });
});

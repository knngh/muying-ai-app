const { audit } = require('../scripts/audit-ai-entrypoint-clients');

describe('AI entrypoint client audit', () => {
  it('keeps real client AI entrypoint telemetry wired', () => {
    const summary = audit();

    expect(summary.ok).toBe(true);
    expect(summary.failures).toEqual([]);
    expect(summary.passed).toBeGreaterThanOrEqual(12);
  });
});

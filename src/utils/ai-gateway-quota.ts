export function resolveAiGatewayUsageLimitRetryAfterAt(message: unknown): string | undefined {
  if (typeof message !== 'string' || !message.trim()) {
    return undefined;
  }

  if (!/usage limit exceeded|weekly usage limit reached|monthly usage limit reached|daily usage limit reached/i.test(message)) {
    return undefined;
  }

  const resetMatch = message.match(/resets at\s+([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.\d+)?(?:Z|[+-][0-9]{2}:[0-9]{2}))/i);
  if (!resetMatch?.[1]) {
    return undefined;
  }

  const resetMs = Date.parse(resetMatch[1]);
  if (!Number.isFinite(resetMs)) {
    return undefined;
  }

  return new Date(resetMs).toISOString();
}

export function isAiGatewayUsageLimitBlocked(message: unknown, nowMs: number): boolean {
  const retryAfterAt = resolveAiGatewayUsageLimitRetryAfterAt(message);
  if (!retryAfterAt) {
    return false;
  }

  const retryAfterMs = Date.parse(retryAfterAt);
  return Number.isFinite(retryAfterMs) && retryAfterMs > nowMs;
}

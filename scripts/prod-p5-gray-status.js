#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_FILE = process.env.P5_OUTPUT_FILE || path.join(ROOT, 'tmp', 'p5-gray-status-report.json');
const BASE_URL = process.env.BASE_URL || 'https://beihu.me';
const API_BASE = process.env.API_BASE || `${BASE_URL}/api/v1`;
const LEGACY_HEALTH_URL = process.env.LEGACY_HEALTH_URL || `${BASE_URL}/api/health`;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'Test123456!';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
const FREE_USERNAME = process.env.FREE_USERNAME || 'demo_free_user';
const FREE_PASSWORD = process.env.FREE_PASSWORD || DEFAULT_PASSWORD;
const VIP_USERNAME = process.env.VIP_USERNAME || 'demo_vip_user';
const VIP_PASSWORD = process.env.VIP_PASSWORD || DEFAULT_PASSWORD;
const POSTPARTUM_USERNAME = process.env.POSTPARTUM_USERNAME || 'demo_postpartum_user';
const POSTPARTUM_PASSWORD = process.env.POSTPARTUM_PASSWORD || DEFAULT_PASSWORD;
const RANGE_DAYS = Number(process.env.P5_RANGE_DAYS || 7);
const LOGIN_RETRY_ATTEMPTS = Number(process.env.P5_LOGIN_RETRY_ATTEMPTS || 1);
const LOGIN_RATE_LIMIT_WAIT_MS = Number(process.env.P5_LOGIN_RATE_LIMIT_WAIT_MS || 15 * 60 * 1000);

function envFlag(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }
  return value === 'true';
}

const COMMANDS = [
  {
    name: 'main_smoke',
    command: 'npm run ops:smoke:prod',
    enabled: envFlag('P5_RUN_MAIN_SMOKE', true),
    args: ['run', 'ops:smoke:prod'],
  },
  {
    name: 'ai_entrypoint_smoke',
    command: 'npm run ops:smoke:ai:entrypoints',
    enabled: envFlag('P5_RUN_AI_ENTRYPOINT_SMOKE', true),
    args: ['run', 'ops:smoke:ai:entrypoints'],
  },
  {
    name: 'ai_websocket_smoke',
    command: 'npm run ops:smoke:ai:ws',
    enabled: envFlag('P5_RUN_AI_WS_SMOKE', true),
    args: ['run', 'ops:smoke:ai:ws'],
  },
  {
    name: 'knowledge_status',
    command: 'npm run ops:knowledge:status',
    enabled: envFlag('P5_RUN_KNOWLEDGE_STATUS', Boolean(process.env.SSH_IDENTITY_FILE || process.env.SSH_PASSWORD)),
    args: ['run', 'ops:knowledge:status'],
  },
];

function tail(value, maxLength = 4000) {
  if (!value) {
    return '';
  }
  return value.length > maxLength ? value.slice(-maxLength) : value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function sumCoverageEvents(items) {
  if (!Array.isArray(items)) {
    return 0;
  }
  return items.reduce((sum, item) => sum + toNumber(toRecord(item).totalTrackedEvents), 0);
}

function coveredEntrySources(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .filter((item) => toNumber(toRecord(item).totalTrackedEvents) > 0)
    .map((item) => String(toRecord(item).entrySource || ''))
    .filter(Boolean)
    .sort();
}

function productEntrypointEvents(items) {
  if (!Array.isArray(items)) {
    return 0;
  }
  return items.reduce((sum, item) => {
    const record = toRecord(item);
    return sum + Math.max(
      toNumber(record.totalTrackedEvents),
      toNumber(record.clickCount)
        + toNumber(record.prefillCount)
        + toNumber(record.messageCount)
        + toNumber(record.serverStartCount)
        + toNumber(record.serverResponseCount)
        + toNumber(record.serverErrorCount)
        + toNumber(record.feedbackCount),
    );
  }, 0);
}

function buildP5GrayReport(input) {
  const blockers = [];
  const attention = [];
  const nextActions = [];
  const commands = Array.isArray(input.commands) ? input.commands : [];
  const failedCommands = commands.filter((command) => command.enabled !== false && command.exitCode !== 0);

  for (const command of failedCommands) {
    blockers.push(`${command.name} failed with exit code ${command.exitCode}`);
  }

  const health = toRecord(input.health);
  if (health.status !== 'ok' || health.database !== 'ok') {
    blockers.push('primary health check is not ok');
  }

  const legacyHealth = toRecord(input.legacyHealth);
  if (legacyHealth.status !== 'ok' || legacyHealth.database !== 'ok') {
    blockers.push('legacy health check is not ok');
  }

  const freeSubscription = toRecord(input.freeSubscription?.data || input.freeSubscription);
  if (freeSubscription.status && freeSubscription.status !== 'free') {
    blockers.push(`free demo user subscription status is ${freeSubscription.status}`);
  }

  const vipSubscription = toRecord(input.vipSubscription?.data || input.vipSubscription);
  if (vipSubscription.status && vipSubscription.status !== 'active') {
    blockers.push(`VIP demo user subscription status is ${vipSubscription.status}`);
  }

  const aiOverviewData = toRecord(input.aiOverview?.data || input.aiOverview);
  const serverAi = toRecord(aiOverviewData.serverAi);
  const aiHealthData = toRecord(input.aiHealth?.data || input.aiHealth);
  const providerBlocks = Array.isArray(aiHealthData.providerBlocks)
    ? aiHealthData.providerBlocks
    : Array.isArray(health.providerBlocks)
      ? health.providerBlocks
    : [];
  const productCoverage = Array.isArray(aiOverviewData.productEntrypointCoverage)
    ? aiOverviewData.productEntrypointCoverage
    : [];
  const opsCoverage = Array.isArray(aiOverviewData.opsProductEntrypointCoverage)
    ? aiOverviewData.opsProductEntrypointCoverage
    : [];

  const requestsStarted = toNumber(serverAi.requestsStarted);
  const responsesCompleted = toNumber(serverAi.responsesCompleted);
  const requestErrors = toNumber(serverAi.requestErrors);
  const errorRate = requestsStarted > 0 ? requestErrors / requestsStarted : 0;
  const completionRate = requestsStarted > 0 ? responsesCompleted / requestsStarted : null;
  const realEntrypointEvents = toNumber(serverAi.realEntrySourceEventCount);
  const realProductEntrypointEvents = productEntrypointEvents(productCoverage);
  const opsEntrypointEvents = sumCoverageEvents(opsCoverage);

  if (requestsStarted > 0 && completionRate !== null && completionRate < 0.9) {
    blockers.push(`AI completion rate is below P5 threshold: ${completionRate.toFixed(4)} < 0.9`);
  }

  if (requestsStarted > 0 && errorRate > 0.2) {
    blockers.push(`AI error rate is above P5 rollback threshold: ${errorRate.toFixed(4)} > 0.2`);
  }

  if (opsEntrypointEvents <= 0) {
    blockers.push('ops product entrypoint coverage is missing');
  }

  if (realEntrypointEvents <= 0 && realProductEntrypointEvents <= 0) {
    attention.push('real user AI entrypoint traffic is still 0');
    nextActions.push('Keep P5 in gray observation and collect real app traffic before closing P5.');
  }

  const degradedRate = typeof serverAi.degradedRate === 'number'
    ? serverAi.degradedRate
    : null;
  if (degradedRate !== null && degradedRate > 0.25) {
    attention.push(`AI degraded rate is ${degradedRate.toFixed(4)}; current provider route is falling back often`);
    if (providerBlocks.length > 0) {
      nextActions.push('Wait for provider usage-limit blocks to clear or configure a healthy primary AI provider before expanding gray traffic.');
    } else {
      nextActions.push('Monitor AI provider health and fallback reasons during gray traffic.');
    }
  }

  const status = blockers.length > 0
    ? 'blocker'
    : attention.length > 0
      ? 'attention'
      : 'pass';

  if (status === 'pass') {
    nextActions.push('Continue P5 gray rollout with daily ops report checks.');
  }

  return {
    generatedAt: input.generatedAt,
    rangeDays: input.rangeDays,
    status,
    canEnterGray: blockers.length === 0,
    canCloseP5: blockers.length === 0 && attention.length === 0,
    blockers,
    attention,
    nextActions,
    commands: commands.map((command) => ({
      name: command.name,
      command: command.command,
      enabled: command.enabled,
      exitCode: command.exitCode,
      durationMs: command.durationMs,
      stdoutTail: command.stdoutTail,
      stderrTail: command.stderrTail,
    })),
    health: {
      primary: health,
      legacy: legacyHealth,
      ai: aiHealthData,
    },
    demos: {
      free: {
        status: freeSubscription.status || null,
        aiLimit: toNumber(freeSubscription.aiLimit, null),
        remainingToday: toNumber(freeSubscription.remainingToday, null),
      },
      vip: {
        status: vipSubscription.status || null,
        plan: vipSubscription.currentPlanCode || vipSubscription.plan || null,
        aiLimit: toNumber(vipSubscription.aiLimit, null),
        remainingToday: toNumber(vipSubscription.remainingToday, null),
      },
    },
    ai: {
      requestsStarted,
      responsesCompleted,
      requestErrors,
      completionRate,
      errorRate: Number(errorRate.toFixed(4)),
      degradedRate,
      realEntrySourceEventCount: realEntrypointEvents,
      productEntrypointEvents: realProductEntrypointEvents,
      opsEntrypointEvents,
      coveredProductEntrypoints: coveredEntrySources(productCoverage),
      coveredOpsEntrypoints: coveredEntrySources(opsCoverage),
      providerBlocks,
    },
    funnel: input.funnel?.data || input.funnel || null,
  };
}

function runCommand(spec) {
  const startedAt = Date.now();
  if (!spec.enabled) {
    return {
      name: spec.name,
      command: spec.command,
      enabled: false,
      exitCode: 0,
      durationMs: 0,
      stdoutTail: '',
      stderrTail: '',
    };
  }

  console.log(`[p5] ${spec.command}`);
  const result = spawnSync('npm', spec.args, {
    cwd: ROOT,
    env: {
      ...process.env,
      ...(spec.env || {}),
    },
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });

  return {
    name: spec.name,
    command: spec.command,
    enabled: true,
    exitCode: result.status === null ? 1 : result.status,
    durationMs: Date.now() - startedAt,
    stdoutTail: tail(result.stdout || ''),
    stderrTail: tail(result.stderr || result.error?.message || ''),
  };
}

async function postJson(url, body, token) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${json.message || text}`);
    error.status = response.status;
    const retryAfter = Number(response.headers.get('retry-after'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      error.retryAfterMs = retryAfter * 1000;
    }
    throw error;
  }
  return json;
}

async function getJson(url, token) {
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${json.message || text}`);
    error.status = response.status;
    throw error;
  }
  return json;
}

async function login(username, password) {
  const response = await postJson(`${API_BASE}/auth/login`, { username, password });
  const token = response?.data?.token;
  if (!token) {
    throw new Error(`Login did not return token for ${username}`);
  }
  return token;
}

function isRateLimitError(error) {
  return error && typeof error === 'object' && error.status === 429;
}

async function loginWithRateLimitRetry(username, password) {
  let attempt = 0;

  while (true) {
    try {
      return await login(username, password);
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= LOGIN_RETRY_ATTEMPTS) {
        throw error;
      }

      const retryAfterMs = Math.max(
        1000,
        Number(error.retryAfterMs) || LOGIN_RATE_LIMIT_WAIT_MS,
      );
      attempt += 1;
      console.warn(`[p5-gray-status] login for ${username} was rate limited; retrying after ${retryAfterMs}ms`);
      await sleep(retryAfterMs);
    }
  }
}

async function loginDemoTokens() {
  const adminToken = process.env.ADMIN_TOKEN || await loginWithRateLimitRetry(ADMIN_USERNAME, ADMIN_PASSWORD);
  const freeToken = process.env.FREE_TOKEN || await loginWithRateLimitRetry(FREE_USERNAME, FREE_PASSWORD);
  const vipToken = process.env.VIP_TOKEN || await loginWithRateLimitRetry(VIP_USERNAME, VIP_PASSWORD);
  const postpartumToken = process.env.POSTPARTUM_TOKEN || await loginWithRateLimitRetry(POSTPARTUM_USERNAME, POSTPARTUM_PASSWORD);

  return { adminToken, freeToken, vipToken, postpartumToken };
}

async function collectSnapshot(tokens) {
  const { adminToken, freeToken, vipToken } = tokens;
  const [
    health,
    legacyHealth,
    aiHealth,
    aiOverview,
    funnel,
    freeSubscription,
    freeQuota,
    vipSubscription,
    vipQuota,
  ] = await Promise.all([
    getJson(`${BASE_URL}/health`),
    getJson(LEGACY_HEALTH_URL),
    getJson(`${API_BASE}/ai/health`),
    getJson(`${API_BASE}/analytics/ai-overview?rangeDays=${RANGE_DAYS}`, adminToken),
    getJson(`${API_BASE}/analytics/funnel?rangeDays=${RANGE_DAYS}`, adminToken),
    getJson(`${API_BASE}/subscription/status`, freeToken),
    getJson(`${API_BASE}/quota/today`, freeToken),
    getJson(`${API_BASE}/subscription/status`, vipToken),
    getJson(`${API_BASE}/quota/today`, vipToken),
  ]);

  return {
    health,
    legacyHealth,
    aiHealth,
    aiOverview,
    funnel,
    freeSubscription,
    freeQuota,
    vipSubscription,
    vipQuota,
  };
}

async function main() {
  const tokens = await loginDemoTokens();
  const commandEnv = {
    ADMIN_TOKEN: tokens.adminToken,
    FREE_TOKEN: tokens.freeToken,
    VIP_TOKEN: tokens.vipToken,
    POSTPARTUM_TOKEN: tokens.postpartumToken,
  };
  const commands = COMMANDS.map((command) => runCommand({
    ...command,
    env: commandEnv,
  }));
  const snapshot = await collectSnapshot(tokens);
  const report = buildP5GrayReport({
    generatedAt: new Date().toISOString(),
    rangeDays: RANGE_DAYS,
    commands,
    ...snapshot,
  });

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));

  if (report.status === 'blocker') {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[p5-gray-status] failed:', error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildP5GrayReport,
};

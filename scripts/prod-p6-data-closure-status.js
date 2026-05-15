#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_FILE = process.env.P6_OUTPUT_FILE || path.join(ROOT, 'tmp', 'p6-data-closure-report.json');
const MARKDOWN_OUTPUT_FILE = process.env.P6_MARKDOWN_OUTPUT_FILE || path.join(ROOT, 'tmp', 'p6-data-closure-summary.md');
const HISTORY_FILE = process.env.P6_HISTORY_FILE || path.join(ROOT, 'tmp', 'p6-data-closure-history.jsonl');
const BASE_URL = process.env.BASE_URL || 'https://beihu.me';
const API_BASE = process.env.API_BASE || `${BASE_URL}/api/v1`;
const LEGACY_HEALTH_URL = process.env.LEGACY_HEALTH_URL || `${BASE_URL}/api/health`;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Test123456!';
const RANGE_DAYS = Number(process.env.P6_RANGE_DAYS || 7);
const IDENTITY_COVERAGE_THRESHOLD = Number(process.env.P6_IDENTITY_COVERAGE_THRESHOLD || 0.8);
const AI_DEGRADED_RATE_THRESHOLD = Number(process.env.P6_AI_DEGRADED_RATE_THRESHOLD || 0.25);

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

function unwrapData(value) {
  const record = toRecord(value);
  return toRecord(record.data || record);
}

function getStep(steps, eventName) {
  if (!Array.isArray(steps)) {
    return {};
  }
  return toRecord(steps.find((step) => toRecord(step).eventName === eventName));
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

function coveredEntrySources(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .filter((item) => productEntrypointEvents([item]) > 0)
    .map((item) => String(toRecord(item).entrySource || ''))
    .filter(Boolean)
    .sort();
}

function getProviderBlocks(aiHealth, primaryHealth) {
  const aiHealthData = unwrapData(aiHealth);
  const primaryHealthData = unwrapData(primaryHealth);
  if (Array.isArray(aiHealthData.providerBlocks)) {
    return aiHealthData.providerBlocks;
  }
  if (Array.isArray(primaryHealthData.providerBlocks)) {
    return primaryHealthData.providerBlocks;
  }
  return [];
}

function formatMetric(value) {
  return value === null || value === undefined ? 'n/a' : String(value);
}

function renderMetricRows(sectionName, rows) {
  return [
    `| ${sectionName} | Metric | Value |`,
    '|---|---|---|',
    ...rows.map(([metric, value]) => `| ${sectionName} | ${metric} | \`${formatMetric(value)}\` |`),
  ].join('\n');
}

function buildP6DataClosureReport(input) {
  const blockers = [];
  const attention = [];
  const nextActions = [];

  const health = unwrapData(input.health);
  if (health.status !== 'ok' || health.database !== 'ok') {
    blockers.push('primary health check is not ok');
  }

  const legacyHealth = unwrapData(input.legacyHealth);
  if (legacyHealth.status !== 'ok' || legacyHealth.database !== 'ok') {
    blockers.push('legacy health check is not ok');
  }

  const funnelData = unwrapData(input.funnel);
  const steps = Array.isArray(funnelData.steps) ? funnelData.steps : [];
  const uniqueSteps = Array.isArray(funnelData.uniqueSteps) ? funnelData.uniqueSteps : [];
  if (steps.length === 0) {
    blockers.push('analytics funnel steps are missing');
  }
  if (uniqueSteps.length === 0) {
    blockers.push('analytics funnel uniqueSteps are missing');
  }

  const firstEventStep = getStep(steps, 'mini_program_app_download_click');
  const paymentEventStep = getStep(steps, 'app_payment_success');
  const firstUniqueStep = getStep(uniqueSteps, 'mini_program_app_download_click');
  const paymentUniqueStep = getStep(uniqueSteps, 'app_payment_success');
  const uniqueSummary = toRecord(funnelData.uniqueSummary);
  const eventFirstStepCount = toNumber(firstEventStep.count);
  const eventPaymentSuccessCount = toNumber(paymentEventStep.count);
  const uniqueFirstStepCount = toNumber(firstUniqueStep.uniqueCount);
  const uniquePaymentSuccessCount = toNumber(paymentUniqueStep.uniqueCount);
  const identityCoverageRate = typeof uniqueSummary.identityCoverageRate === 'number'
    ? uniqueSummary.identityCoverageRate
    : null;

  if (eventFirstStepCount <= 0 && uniqueFirstStepCount <= 0) {
    attention.push('funnel acquisition traffic is 0');
    nextActions.push('Keep collecting real mini-program and app traffic before closing P6.');
  }
  if (eventPaymentSuccessCount <= 0 && uniquePaymentSuccessCount <= 0) {
    attention.push('payment success traffic is 0');
    nextActions.push('Do not treat monetization conversion as validated until payment success appears in the funnel.');
  }
  if (identityCoverageRate !== null && identityCoverageRate < IDENTITY_COVERAGE_THRESHOLD) {
    attention.push(`analytics identity coverage is below ${IDENTITY_COVERAGE_THRESHOLD}: ${identityCoverageRate.toFixed(4)}`);
    nextActions.push('Audit clientId/sessionId propagation for app and mini-program analytics events.');
  }

  const aiOverview = unwrapData(input.aiOverview);
  const serverAi = toRecord(aiOverview.serverAi);
  const requestsStarted = toNumber(serverAi.requestsStarted);
  const responsesCompleted = toNumber(serverAi.responsesCompleted);
  const requestErrors = toNumber(serverAi.requestErrors);
  const degradedRate = typeof serverAi.degradedRate === 'number' ? serverAi.degradedRate : null;
  const providerBlocks = getProviderBlocks(input.aiHealth, input.health);
  const productCoverage = Array.isArray(aiOverview.productEntrypointCoverage)
    ? aiOverview.productEntrypointCoverage
    : [];
  const productEvents = productEntrypointEvents(productCoverage);

  if (requestsStarted <= 0) {
    attention.push('server AI analytics traffic is 0');
    nextActions.push('Collect at least one real AI request in the report window before closing P6.');
  }
  if (degradedRate !== null && degradedRate > AI_DEGRADED_RATE_THRESHOLD) {
    attention.push(`AI degraded rate is ${degradedRate.toFixed(4)}`);
    nextActions.push('Keep AI provider health in the P6 daily report until degradation returns to the threshold.');
  }
  if (providerBlocks.length > 0) {
    attention.push('active AI provider blocks are present');
    nextActions.push('Wait for provider usage-limit blocks to clear or configure a healthy primary AI provider.');
  }
  if (productEvents <= 0) {
    attention.push('real product AI entrypoint traffic is 0');
    nextActions.push('Keep product AI entrypoint tracking under observation until real user traffic is present.');
  }

  const activationOverview = unwrapData(input.activationOverview);
  const activationCounts = toRecord(activationOverview.counts);
  const profileReadyUniqueCount = toNumber(activationCounts.profileReadyUniqueCount);
  const aiQuestionUniqueCount = toNumber(activationCounts.aiQuestionUniqueCount);
  const knowledgeOpenUniqueCount = toNumber(activationCounts.knowledgeOpenUniqueCount);
  const valueActionUniqueCount = toNumber(activationCounts.valueActionUniqueCount);
  const activatedUniqueCount = toNumber(activationCounts.activatedUniqueCount);
  const profileToActivationRate = typeof activationCounts.profileToActivationRate === 'number'
    ? activationCounts.profileToActivationRate
    : null;
  const activationIdentityCoverageRate = typeof activationCounts.identityCoverageRate === 'number'
    ? activationCounts.identityCoverageRate
    : null;

  if (profileReadyUniqueCount > 0 && activatedUniqueCount <= 0) {
    attention.push('activation completed user count is 0');
    nextActions.push('Inspect first-day activation flow: profile setup is present but AI question or knowledge-open value action is missing.');
  }
  if (activationIdentityCoverageRate !== null && activationIdentityCoverageRate < IDENTITY_COVERAGE_THRESHOLD) {
    attention.push(`activation identity coverage is below ${IDENTITY_COVERAGE_THRESHOLD}: ${activationIdentityCoverageRate.toFixed(4)}`);
    nextActions.push('Audit identity propagation for profile readiness, AI question, and knowledge detail open analytics.');
  }

  const retentionOverview = unwrapData(input.retentionOverview);
  const retentionSummary = toRecord(retentionOverview.summary);
  const retentionCohortUserCount = toNumber(retentionSummary.cohortUserCount);
  const d1EligibleCohortUserCount = toNumber(retentionSummary.d1EligibleCohortUserCount);
  const d1RetainedUserCount = toNumber(retentionSummary.d1RetainedUserCount);
  const d1RetentionRate = typeof retentionSummary.d1RetentionRate === 'number'
    ? retentionSummary.d1RetentionRate
    : null;
  const d7EligibleCohortUserCount = toNumber(retentionSummary.d7EligibleCohortUserCount);
  const d7RetainedUserCount = toNumber(retentionSummary.d7RetainedUserCount);
  const d7RetentionRate = typeof retentionSummary.d7RetentionRate === 'number'
    ? retentionSummary.d7RetentionRate
    : null;
  const retentionIdentityCoverageRate = typeof retentionSummary.identityCoverageRate === 'number'
    ? retentionSummary.identityCoverageRate
    : null;
  const retentionIgnoredOpsEventCount = toNumber(retentionSummary.ignoredOpsEventCount);
  const retentionBehaviorEventCount = toNumber(retentionSummary.retentionBehaviorEventCount);
  const retentionBreakdown = toRecord(retentionOverview.breakdown);

  if (d1EligibleCohortUserCount > 0 && d1RetainedUserCount <= 0) {
    attention.push('D1 retention is 0');
    nextActions.push('Review early user return paths: home return plan, AI follow-up, knowledge detail, and weekly report entrypoints.');
  }
  if (retentionIdentityCoverageRate !== null && retentionIdentityCoverageRate < IDENTITY_COVERAGE_THRESHOLD) {
    attention.push(`retention identity coverage is below ${IDENTITY_COVERAGE_THRESHOLD}: ${retentionIdentityCoverageRate.toFixed(4)}`);
    nextActions.push('Audit identity propagation for active behavior events used by D1/D7 retention.');
  }

  const status = blockers.length > 0
    ? 'blocker'
    : attention.length > 0
      ? 'attention'
      : 'pass';

  if (status === 'pass') {
    nextActions.push('P6 data closure can be used as the daily operating report.');
  }

  const engineeringClosure = {
    status: blockers.length === 0 ? 'closed' : 'blocked',
    hasDailyReport: blockers.length === 0,
    hasUniqueFunnel: uniqueSteps.length > 0,
    hasAIOverview: Object.keys(aiOverview).length > 0,
    hasActivationOverview: Object.keys(activationOverview).length > 0,
    hasRetentionOverview: Object.keys(retentionOverview).length > 0,
    hasReadableSummary: true,
    hasHistoryArchive: true,
    remainingOperationalSignals: attention,
  };
  const canCloseP6Engineering = engineeringClosure.status === 'closed'
    && engineeringClosure.hasDailyReport
    && engineeringClosure.hasUniqueFunnel
    && engineeringClosure.hasAIOverview
    && engineeringClosure.hasActivationOverview
    && engineeringClosure.hasRetentionOverview
    && engineeringClosure.hasReadableSummary
    && engineeringClosure.hasHistoryArchive;

  return {
    generatedAt: input.generatedAt,
    rangeDays: input.rangeDays,
    status,
    canUseAsDailyReport: blockers.length === 0,
    canCloseP6Engineering,
    canCloseP6: blockers.length === 0 && attention.length === 0,
    engineeringClosure,
    blockers,
    attention,
    nextActions: Array.from(new Set(nextActions)),
    health: {
      primary: health,
      legacy: legacyHealth,
      ai: unwrapData(input.aiHealth),
    },
    funnel: {
      rangeDays: toNumber(funnelData.rangeDays, input.rangeDays),
      eventFirstStepCount,
      eventPaymentSuccessCount,
      uniqueFirstStepCount,
      uniquePaymentSuccessCount,
      identityCoverageRate,
      uniqueSummary,
      steps,
      uniqueSteps,
    },
    ai: {
      requestsStarted,
      responsesCompleted,
      requestErrors,
      degradedRate,
      providerBlocks,
      productEntrypointEvents: productEvents,
      coveredProductEntrypoints: coveredEntrySources(productCoverage),
    },
    activation: {
      profileReadyUniqueCount,
      aiQuestionUniqueCount,
      knowledgeOpenUniqueCount,
      valueActionUniqueCount,
      activatedUniqueCount,
      profileToActivationRate,
      identityCoverageRate: activationIdentityCoverageRate,
      breakdown: toRecord(activationOverview.breakdown),
    },
    retention: {
      cohortUserCount: retentionCohortUserCount,
      d1EligibleCohortUserCount,
      d1RetainedUserCount,
      d1RetentionRate,
      d7EligibleCohortUserCount,
      d7RetainedUserCount,
      d7RetentionRate,
      identityCoverageRate: retentionIdentityCoverageRate,
      ignoredOpsEventCount: retentionIgnoredOpsEventCount,
      retentionBehaviorEventCount,
      behaviorByEvent: Array.isArray(retentionBreakdown.retentionBehaviorByEvent)
        ? retentionBreakdown.retentionBehaviorByEvent
        : [],
      cohorts: Array.isArray(retentionOverview.cohorts) ? retentionOverview.cohorts : [],
    },
  };
}

function buildP6DataClosureMarkdown(report) {
  const behaviorByEvent = Array.isArray(report.retention?.behaviorByEvent)
    ? report.retention.behaviorByEvent
    : [];
  const attentionItems = Array.isArray(report.attention) && report.attention.length > 0
    ? report.attention.map((item) => `- ${item}`).join('\n')
    : '- None';
  const blockers = Array.isArray(report.blockers) && report.blockers.length > 0
    ? report.blockers.map((item) => `- ${item}`).join('\n')
    : '- None';
  const nextActions = Array.isArray(report.nextActions) && report.nextActions.length > 0
    ? report.nextActions.map((item) => `- ${item}`).join('\n')
    : '- None';
  const behaviorLines = behaviorByEvent.length > 0
    ? behaviorByEvent.map((item) => `- ${item.key}: ${item.count}`).join('\n')
    : '- None';

  return [
    '# P6 Data Closure Daily Summary',
    '',
    `- Generated at: \`${report.generatedAt}\``,
    `- Range days: \`${report.rangeDays}\``,
    `- Status: \`${report.status}\``,
    `- Can use as daily report: \`${report.canUseAsDailyReport}\``,
    `- Can close P6 engineering: \`${report.canCloseP6Engineering}\``,
    `- Can close P6: \`${report.canCloseP6}\``,
    '',
    renderMetricRows('Funnel', [
      ['Unique acquisition users', report.funnel?.uniqueFirstStepCount],
      ['Unique payment success users', report.funnel?.uniquePaymentSuccessCount],
      ['Identity coverage', report.funnel?.identityCoverageRate],
    ]),
    '',
    renderMetricRows('AI', [
      ['Requests started', report.ai?.requestsStarted],
      ['Degraded rate', report.ai?.degradedRate],
      ['Product entrypoint events', report.ai?.productEntrypointEvents],
      ['Covered entrypoints', Array.isArray(report.ai?.coveredProductEntrypoints) ? report.ai.coveredProductEntrypoints.join(', ') : ''],
    ]),
    '',
    renderMetricRows('Activation', [
      ['Profile ready users', report.activation?.profileReadyUniqueCount],
      ['Activated users', report.activation?.activatedUniqueCount],
      ['Profile to activation rate', report.activation?.profileToActivationRate],
    ]),
    '',
    renderMetricRows('Retention', [
      ['Cohort users', report.retention?.cohortUserCount],
      ['D1 retention', report.retention?.d1RetentionRate],
      ['D7 retention', report.retention?.d7RetentionRate],
      ['Retention identity coverage', report.retention?.identityCoverageRate],
      ['Retention behavior events', report.retention?.retentionBehaviorEventCount],
    ]),
    '',
    '## Retention Behavior',
    '',
    behaviorLines,
    '',
    '## Attention',
    '',
    attentionItems,
    '',
    '## Blockers',
    '',
    blockers,
    '',
    '## Next Actions',
    '',
    nextActions,
    '',
  ].join('\n');
}

function buildP6DataClosureHistoryRecord(report) {
  return {
    generatedAt: report.generatedAt,
    rangeDays: report.rangeDays,
    status: report.status,
    canUseAsDailyReport: report.canUseAsDailyReport,
    canCloseP6: report.canCloseP6,
    blockersCount: Array.isArray(report.blockers) ? report.blockers.length : 0,
    attentionCount: Array.isArray(report.attention) ? report.attention.length : 0,
    funnel: {
      uniqueFirstStepCount: report.funnel?.uniqueFirstStepCount ?? null,
      uniquePaymentSuccessCount: report.funnel?.uniquePaymentSuccessCount ?? null,
      identityCoverageRate: report.funnel?.identityCoverageRate ?? null,
    },
    ai: {
      requestsStarted: report.ai?.requestsStarted ?? null,
      degradedRate: report.ai?.degradedRate ?? null,
      productEntrypointEvents: report.ai?.productEntrypointEvents ?? null,
    },
    activation: {
      profileReadyUniqueCount: report.activation?.profileReadyUniqueCount ?? null,
      activatedUniqueCount: report.activation?.activatedUniqueCount ?? null,
      profileToActivationRate: report.activation?.profileToActivationRate ?? null,
    },
    retention: {
      cohortUserCount: report.retention?.cohortUserCount ?? null,
      d1RetentionRate: report.retention?.d1RetentionRate ?? null,
      d7RetentionRate: report.retention?.d7RetentionRate ?? null,
      retentionBehaviorEventCount: report.retention?.retentionBehaviorEventCount ?? null,
    },
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
    throw new Error(`HTTP ${response.status}: ${json.message || text}`);
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
    throw new Error(`HTTP ${response.status}: ${json.message || text}`);
  }
  return json;
}

async function login() {
  if (process.env.ADMIN_TOKEN) {
    return process.env.ADMIN_TOKEN;
  }

  const response = await postJson(`${API_BASE}/auth/login`, {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  });
  const token = response?.data?.token;
  if (!token) {
    throw new Error('Admin login did not return token');
  }
  return token;
}

async function collectSnapshot(adminToken) {
  const [
    health,
    legacyHealth,
    aiHealth,
    funnel,
    aiOverview,
    activationOverview,
    retentionOverview,
  ] = await Promise.all([
    getJson(`${BASE_URL}/health`),
    getJson(LEGACY_HEALTH_URL),
    getJson(`${API_BASE}/ai/health`),
    getJson(`${API_BASE}/analytics/funnel?rangeDays=${RANGE_DAYS}`, adminToken),
    getJson(`${API_BASE}/analytics/ai-overview?rangeDays=${RANGE_DAYS}`, adminToken),
    getJson(`${API_BASE}/analytics/activation-overview?rangeDays=${RANGE_DAYS}`, adminToken),
    getJson(`${API_BASE}/analytics/retention-overview?rangeDays=${RANGE_DAYS}`, adminToken),
  ]);

  return {
    health,
    legacyHealth,
    aiHealth,
    funnel,
    aiOverview,
    activationOverview,
    retentionOverview,
  };
}

async function main() {
  const adminToken = await login();
  const snapshot = await collectSnapshot(adminToken);
  const report = buildP6DataClosureReport({
    generatedAt: new Date().toISOString(),
    rangeDays: RANGE_DAYS,
    ...snapshot,
  });

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), 'utf8');
  fs.mkdirSync(path.dirname(MARKDOWN_OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(MARKDOWN_OUTPUT_FILE, buildP6DataClosureMarkdown(report), 'utf8');
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  fs.appendFileSync(HISTORY_FILE, `${JSON.stringify(buildP6DataClosureHistoryRecord(report))}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));

  if (report.status === 'blocker') {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[p6-data-closure-status] failed:', error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildP6DataClosureReport,
  buildP6DataClosureMarkdown,
  buildP6DataClosureHistoryRecord,
};

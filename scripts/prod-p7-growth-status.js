#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const {
  buildP6DataClosureReport,
  buildP6DataClosureHistoryRecord,
} = require('./prod-p6-data-closure-status');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_FILE = process.env.P7_OUTPUT_FILE || path.join(ROOT, 'tmp', 'p7-growth-status-report.json');
const MARKDOWN_OUTPUT_FILE = process.env.P7_MARKDOWN_OUTPUT_FILE || path.join(ROOT, 'tmp', 'p7-growth-summary.md');
const HISTORY_FILE = process.env.P7_HISTORY_FILE || path.join(ROOT, 'tmp', 'p7-growth-history.jsonl');
const P6_HISTORY_FILE = process.env.P6_HISTORY_FILE || path.join(ROOT, 'tmp', 'p6-data-closure-history.jsonl');
const BASE_URL = process.env.BASE_URL || 'https://beihu.me';
const API_BASE = process.env.API_BASE || `${BASE_URL}/api/v1`;
const LEGACY_HEALTH_URL = process.env.LEGACY_HEALTH_URL || `${BASE_URL}/api/health`;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Test123456!';
const RANGE_DAYS = Number(process.env.P7_RANGE_DAYS || process.env.P6_RANGE_DAYS || 7);
const MIN_ACQUISITION_UNIQUE_COUNT = Number(process.env.P7_MIN_ACQUISITION_UNIQUE_COUNT || 1);
const MIN_ACTIVATED_UNIQUE_COUNT = Number(process.env.P7_MIN_ACTIVATED_UNIQUE_COUNT || 1);
const MIN_PAYMENT_SUCCESS_UNIQUE_COUNT = Number(process.env.P7_MIN_PAYMENT_SUCCESS_UNIQUE_COUNT || 1);
const AI_DEGRADED_RATE_THRESHOLD = Number(process.env.P7_AI_DEGRADED_RATE_THRESHOLD || 0.25);
const IDENTITY_COVERAGE_THRESHOLD = Number(process.env.P7_IDENTITY_COVERAGE_THRESHOLD || 0.8);
const P7_ATTRIBUTION_COVERAGE_THRESHOLD = Number(process.env.P7_ATTRIBUTION_COVERAGE_THRESHOLD || 0.9);

function toRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function unwrapData(value) {
  const record = toRecord(value);
  return toRecord(record.data || record);
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

function toNullableNumber(value) {
  return value === null || value === undefined ? null : toNumber(value, null);
}

function isAcquisitionAttributionDimension(value) {
  return typeof value === 'string' && ['channel', 'campaign', 'scene', 'entrySource'].includes(value);
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

function parseP6HistoryLines(content) {
  return String(content || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((record) => record && typeof record === 'object')
    .sort((left, right) => String(left.generatedAt || '').localeCompare(String(right.generatedAt || '')));
}

function readP6HistoryRecords(filePath = P6_HISTORY_FILE) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return parseP6HistoryLines(fs.readFileSync(filePath, 'utf8'));
}

function getTrend(records, getter) {
  const values = records
    .map(getter)
    .map((value) => toNullableNumber(value))
    .filter((value) => typeof value === 'number' && Number.isFinite(value));

  if (values.length === 0) {
    return {
      first: null,
      latest: null,
      delta: null,
      direction: 'unknown',
      sampleCount: 0,
    };
  }

  const first = values[0];
  const latest = values[values.length - 1];
  const delta = Number((latest - first).toFixed(4));
  return {
    first,
    latest,
    delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    sampleCount: values.length,
  };
}

function normalizeAcquisitionOverview(value) {
  const overview = unwrapData(value);
  const summary = toRecord(overview.summary);
  const breakdown = toRecord(overview.breakdown);
  const attributionQuality = toRecord(overview.attributionQuality);
  const attributionDimensions = Array.isArray(attributionQuality.dimensions)
    ? attributionQuality.dimensions
      .map((item) => {
        const dimension = toRecord(item);
        const name = isAcquisitionAttributionDimension(dimension.dimension) ? dimension.dimension : null;
        if (!name) {
          return null;
        }

        return {
          dimension: name,
          attributedEventCount: toNumber(dimension.attributedEventCount),
          missingEventCount: toNumber(dimension.missingEventCount),
          eventCoverageRate: toNullableNumber(dimension.eventCoverageRate),
          attributedUniqueCount: toNumber(dimension.attributedUniqueCount),
          uniqueCoverageRate: toNullableNumber(dimension.uniqueCoverageRate),
        };
      })
      .filter(Boolean)
    : [];
  const attributionRequiredDimensions = Array.isArray(attributionQuality.requiredDimensions)
    ? attributionQuality.requiredDimensions.filter(isAcquisitionAttributionDimension)
    : [];

  return {
    rangeDays: toNumber(overview.rangeDays, RANGE_DAYS),
    summary: {
      acquisitionEventCount: toNumber(summary.acquisitionEventCount),
      acquisitionUniqueCount: toNumber(summary.acquisitionUniqueCount),
      activatedUniqueCount: toNumber(summary.activatedUniqueCount),
      orderCreatedUniqueCount: toNumber(summary.orderCreatedUniqueCount),
      paymentSuccessUniqueCount: toNumber(summary.paymentSuccessUniqueCount),
      retentionBehaviorUniqueCount: toNumber(summary.retentionBehaviorUniqueCount),
      identityCoverageRate: typeof summary.identityCoverageRate === 'number' ? summary.identityCoverageRate : null,
      ignoredOpsEventCount: toNumber(summary.ignoredOpsEventCount),
      acquisitionToActivationRate: typeof summary.acquisitionToActivationRate === 'number' ? summary.acquisitionToActivationRate : null,
      acquisitionToOrderRate: typeof summary.acquisitionToOrderRate === 'number' ? summary.acquisitionToOrderRate : null,
      acquisitionToPaymentRate: typeof summary.acquisitionToPaymentRate === 'number' ? summary.acquisitionToPaymentRate : null,
      acquisitionToRetentionBehaviorRate: typeof summary.acquisitionToRetentionBehaviorRate === 'number'
        ? summary.acquisitionToRetentionBehaviorRate
        : null,
    },
    breakdown: {
      byChannel: Array.isArray(breakdown.byChannel) ? breakdown.byChannel : [],
      byCampaign: Array.isArray(breakdown.byCampaign) ? breakdown.byCampaign : [],
      byScene: Array.isArray(breakdown.byScene) ? breakdown.byScene : [],
      byEntrySource: Array.isArray(breakdown.byEntrySource) ? breakdown.byEntrySource : [],
    },
    attributionQuality: Object.keys(attributionQuality).length > 0
      ? {
        acquisitionEventCount: toNumber(attributionQuality.acquisitionEventCount),
        acquisitionUniqueCount: toNumber(attributionQuality.acquisitionUniqueCount),
        requiredDimensions: attributionRequiredDimensions.length > 0
          ? attributionRequiredDimensions
          : ['channel', 'campaign', 'scene', 'entrySource'],
        dimensions: attributionDimensions,
      }
      : null,
    topAcquisitionSegments: Array.isArray(overview.topAcquisitionSegments) ? overview.topAcquisitionSegments : [],
  };
}

function buildP7GrowthReport(input) {
  const blockers = [];
  const attention = [];
  const nextActions = [];
  const p6Report = toRecord(input.p6Report);
  const rawAcquisitionOverview = unwrapData(input.acquisitionOverview);
  const rawAcquisitionSummary = toRecord(rawAcquisitionOverview.summary);
  const acquisition = normalizeAcquisitionOverview(input.acquisitionOverview);
  const p6HistoryRecords = Array.isArray(input.p6HistoryRecords) ? input.p6HistoryRecords : [];

  if (p6Report.canUseAsDailyReport !== true) {
    blockers.push('P6 daily report is not usable');
  }
  if (p6Report.canCloseP6Engineering !== true) {
    blockers.push('P6 engineering closure is not complete');
  }
  if (Object.keys(rawAcquisitionSummary).length === 0) {
    blockers.push('P7 acquisition overview summary is missing');
  }

  const p6Blockers = Array.isArray(p6Report.blockers) ? p6Report.blockers : [];
  if (p6Blockers.length > 0) {
    blockers.push(...p6Blockers.map((item) => `P6 blocker: ${item}`));
  }

  if (p6Report.canCloseP6 !== true) {
    attention.push('P6 operational closure is still pending');
    nextActions.push('Keep using P6 daily data as the P7 operational baseline instead of treating P6 business metrics as closed.');
  }

  const acquisitionSummary = acquisition.summary;
  if (acquisitionSummary.acquisitionUniqueCount < MIN_ACQUISITION_UNIQUE_COUNT) {
    attention.push('P7 acquisition unique traffic is below threshold');
    nextActions.push('Drive at least one real mini-program/App acquisition segment before evaluating P7 conversion quality.');
  }
  if (acquisitionSummary.activatedUniqueCount < MIN_ACTIVATED_UNIQUE_COUNT) {
    attention.push('P7 activated users from acquisition are below threshold');
    nextActions.push('Inspect the first-run path from acquisition touchpoint to lifecycle profile and AI/knowledge value action.');
  }
  if (acquisitionSummary.paymentSuccessUniqueCount < MIN_PAYMENT_SUCCESS_UNIQUE_COUNT) {
    attention.push('P7 payment success attribution is 0');
    nextActions.push('Keep P7 in operating observation until payment success appears from a real acquisition segment.');
  }
  if (
    acquisitionSummary.identityCoverageRate !== null
    && acquisitionSummary.identityCoverageRate < IDENTITY_COVERAGE_THRESHOLD
  ) {
    attention.push(`P7 acquisition identity coverage is below ${IDENTITY_COVERAGE_THRESHOLD}: ${acquisitionSummary.identityCoverageRate.toFixed(4)}`);
    nextActions.push('Audit channel/campaign analytics payloads to ensure clientId or userId survives from acquisition to activation.');
  }

  const attributionQuality = acquisition.attributionQuality;
  const lowCoverageDimensions = Array.isArray(attributionQuality?.dimensions)
    ? attributionQuality.dimensions.filter((item) => (
      typeof item.eventCoverageRate === 'number'
      && item.eventCoverageRate < P7_ATTRIBUTION_COVERAGE_THRESHOLD
    ))
    : [];
  for (const dimension of lowCoverageDimensions) {
    attention.push(`P7 attribution coverage for ${dimension.dimension} is below threshold: ${dimension.eventCoverageRate.toFixed(4)}`);
  }
  if (lowCoverageDimensions.length > 0) {
    nextActions.push('Audit the mini-program acquisition query builders and share payloads to keep channel, campaign, scene and entrySource on the same link.');
  }

  const p6Ai = toRecord(p6Report.ai);
  const degradedRate = typeof p6Ai.degradedRate === 'number' ? p6Ai.degradedRate : null;
  if (degradedRate !== null && degradedRate > AI_DEGRADED_RATE_THRESHOLD) {
    attention.push(`AI degraded rate is ${degradedRate.toFixed(4)}`);
    nextActions.push('Do not scale acquisition before provider health or fallback acceptance criteria are explicit.');
  }

  const p6Funnel = toRecord(p6Report.funnel);
  const p6Retention = toRecord(p6Report.retention);
  const p6Activation = toRecord(p6Report.activation);
  const trends = {
    historyRecordCount: p6HistoryRecords.length,
    acquisitionTrend: getTrend(p6HistoryRecords, (record) => toRecord(record.funnel).uniqueFirstStepCount),
    paymentTrend: getTrend(p6HistoryRecords, (record) => toRecord(record.funnel).uniquePaymentSuccessCount),
    aiDegradedTrend: getTrend(p6HistoryRecords, (record) => toRecord(record.ai).degradedRate),
    activationTrend: getTrend(p6HistoryRecords, (record) => toRecord(record.activation).activatedUniqueCount),
    retentionBehaviorTrend: getTrend(p6HistoryRecords, (record) => toRecord(record.retention).retentionBehaviorEventCount),
  };

  const hasHistoryArchive = p6HistoryRecords.length > 0;
  const hasAcquisitionOverview = blockers.indexOf('P7 acquisition overview summary is missing') < 0;
  const status = blockers.length > 0
    ? 'blocker'
    : attention.length > 0
      ? 'observe'
      : 'pass';
  const canCloseP7Engineering = blockers.length === 0
    && p6Report.canUseAsDailyReport === true
    && p6Report.canCloseP6Engineering === true
    && hasAcquisitionOverview;
  const canUseAsP7DailyReport = blockers.length === 0 && canCloseP7Engineering;
  const canCloseP7 = canCloseP7Engineering && attention.length === 0;

  if (status === 'pass') {
    nextActions.push('P7 growth observation can move from engineering closure to routine operations.');
  }
  if (!hasHistoryArchive) {
    nextActions.push('Run P6/P7 reports daily so trend direction is based on JSONL history rather than one snapshot.');
  }

  return {
    generatedAt: input.generatedAt,
    rangeDays: input.rangeDays,
    status,
    canUseAsP7DailyReport,
    canCloseP7Engineering,
    canCloseP7,
    blockers,
    attention: Array.from(new Set(attention)),
    nextActions: Array.from(new Set(nextActions)),
    p6: {
      status: p6Report.status || null,
      canUseAsDailyReport: p6Report.canUseAsDailyReport === true,
      canCloseP6Engineering: p6Report.canCloseP6Engineering === true,
      canCloseP6: p6Report.canCloseP6 === true,
      attention: Array.isArray(p6Report.attention) ? p6Report.attention : [],
      funnel: {
        uniqueFirstStepCount: toNumber(p6Funnel.uniqueFirstStepCount),
        uniquePaymentSuccessCount: toNumber(p6Funnel.uniquePaymentSuccessCount),
        identityCoverageRate: typeof p6Funnel.identityCoverageRate === 'number' ? p6Funnel.identityCoverageRate : null,
      },
      ai: {
        requestsStarted: toNumber(p6Ai.requestsStarted),
        degradedRate,
        productEntrypointEvents: toNumber(p6Ai.productEntrypointEvents),
        coveredProductEntrypoints: Array.isArray(p6Ai.coveredProductEntrypoints) ? p6Ai.coveredProductEntrypoints : [],
      },
      activation: {
        profileReadyUniqueCount: toNumber(p6Activation.profileReadyUniqueCount),
        activatedUniqueCount: toNumber(p6Activation.activatedUniqueCount),
        profileToActivationRate: typeof p6Activation.profileToActivationRate === 'number'
          ? p6Activation.profileToActivationRate
          : null,
      },
      retention: {
        cohortUserCount: toNumber(p6Retention.cohortUserCount),
        d1RetentionRate: typeof p6Retention.d1RetentionRate === 'number' ? p6Retention.d1RetentionRate : null,
        d7RetentionRate: typeof p6Retention.d7RetentionRate === 'number' ? p6Retention.d7RetentionRate : null,
        retentionBehaviorEventCount: toNumber(p6Retention.retentionBehaviorEventCount),
      },
    },
    acquisition,
    trends,
    engineeringClosure: {
      status: canCloseP7Engineering ? 'closed' : 'blocked',
      hasP6DailyReport: p6Report.canUseAsDailyReport === true,
      hasP6EngineeringClosure: p6Report.canCloseP6Engineering === true,
      hasAcquisitionOverview,
      hasP6HistoryArchive: hasHistoryArchive,
      hasReadableSummary: true,
      remainingOperationalSignals: Array.from(new Set(attention)),
    },
  };
}

function formatSegment(segment) {
  const parts = [
    segment.channel,
    segment.campaign,
    segment.scene,
    segment.entrySource,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : 'unknown';
}

function buildP7GrowthMarkdown(report) {
  const attentionItems = Array.isArray(report.attention) && report.attention.length > 0
    ? report.attention.map((item) => `- ${item}`).join('\n')
    : '- None';
  const blockers = Array.isArray(report.blockers) && report.blockers.length > 0
    ? report.blockers.map((item) => `- ${item}`).join('\n')
    : '- None';
  const nextActions = Array.isArray(report.nextActions) && report.nextActions.length > 0
    ? report.nextActions.map((item) => `- ${item}`).join('\n')
    : '- None';
  const channelLines = Array.isArray(report.acquisition?.breakdown?.byChannel) && report.acquisition.breakdown.byChannel.length > 0
    ? report.acquisition.breakdown.byChannel
      .slice(0, 10)
      .map((item) => `- ${item.key}: acquisition=${item.acquisitionUniqueCount}, activated=${item.activatedUniqueCount}, payment=${item.paymentSuccessUniqueCount}`)
      .join('\n')
    : '- None';
  const segmentLines = Array.isArray(report.acquisition?.topAcquisitionSegments) && report.acquisition.topAcquisitionSegments.length > 0
    ? report.acquisition.topAcquisitionSegments
      .slice(0, 10)
      .map((item) => `- ${formatSegment(item)}: acquisition=${item.acquisitionUniqueCount}, activated=${item.activatedUniqueCount}, payment=${item.paymentSuccessUniqueCount}`)
      .join('\n')
    : '- None';
  const attributionQualityLines = Array.isArray(report.acquisition?.attributionQuality?.dimensions) && report.acquisition.attributionQuality.dimensions.length > 0
    ? report.acquisition.attributionQuality.dimensions
      .map((item) => `- ${item.dimension}: eventCoverage=${formatMetric(item.eventCoverageRate)}, uniqueCoverage=${formatMetric(item.uniqueCoverageRate)}, attributedEvents=${item.attributedEventCount}, missingEvents=${item.missingEventCount}`)
      .join('\n')
    : '- None';

  return [
    '# P7 Growth Operations Summary',
    '',
    `- Generated at: \`${report.generatedAt}\``,
    `- Range days: \`${report.rangeDays}\``,
    `- Status: \`${report.status}\``,
    `- Can use as P7 daily report: \`${report.canUseAsP7DailyReport}\``,
    `- Can close P7 engineering: \`${report.canCloseP7Engineering}\``,
    `- Can close P7: \`${report.canCloseP7}\``,
    '',
    renderMetricRows('Acquisition', [
      ['Unique acquisition users', report.acquisition?.summary?.acquisitionUniqueCount],
      ['Activated users from acquisition', report.acquisition?.summary?.activatedUniqueCount],
      ['Payment success users from acquisition', report.acquisition?.summary?.paymentSuccessUniqueCount],
      ['Acquisition to activation rate', report.acquisition?.summary?.acquisitionToActivationRate],
      ['Acquisition to payment rate', report.acquisition?.summary?.acquisitionToPaymentRate],
      ['Identity coverage', report.acquisition?.summary?.identityCoverageRate],
    ]),
    '',
    '## Attribution Quality',
    '',
    attributionQualityLines,
    '',
    renderMetricRows('P6 Baseline', [
      ['P6 status', report.p6?.status],
      ['P6 acquisition users', report.p6?.funnel?.uniqueFirstStepCount],
      ['P6 payment users', report.p6?.funnel?.uniquePaymentSuccessCount],
      ['AI degraded rate', report.p6?.ai?.degradedRate],
      ['D1 retention', report.p6?.retention?.d1RetentionRate],
      ['Retention behavior events', report.p6?.retention?.retentionBehaviorEventCount],
    ]),
    '',
    renderMetricRows('Trends', [
      ['History records', report.trends?.historyRecordCount],
      ['Acquisition direction', report.trends?.acquisitionTrend?.direction],
      ['Acquisition delta', report.trends?.acquisitionTrend?.delta],
      ['Payment direction', report.trends?.paymentTrend?.direction],
      ['Payment delta', report.trends?.paymentTrend?.delta],
      ['AI degraded direction', report.trends?.aiDegradedTrend?.direction],
    ]),
    '',
    '## Top Channels',
    '',
    channelLines,
    '',
    '## Top Acquisition Segments',
    '',
    segmentLines,
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

function buildP7GrowthHistoryRecord(report) {
  return {
    generatedAt: report.generatedAt,
    rangeDays: report.rangeDays,
    status: report.status,
    canUseAsP7DailyReport: report.canUseAsP7DailyReport,
    canCloseP7Engineering: report.canCloseP7Engineering,
    canCloseP7: report.canCloseP7,
    blockersCount: Array.isArray(report.blockers) ? report.blockers.length : 0,
    attentionCount: Array.isArray(report.attention) ? report.attention.length : 0,
    acquisition: {
      acquisitionUniqueCount: report.acquisition?.summary?.acquisitionUniqueCount ?? null,
      activatedUniqueCount: report.acquisition?.summary?.activatedUniqueCount ?? null,
      paymentSuccessUniqueCount: report.acquisition?.summary?.paymentSuccessUniqueCount ?? null,
      acquisitionToActivationRate: report.acquisition?.summary?.acquisitionToActivationRate ?? null,
      acquisitionToPaymentRate: report.acquisition?.summary?.acquisitionToPaymentRate ?? null,
    },
    p6: {
      status: report.p6?.status ?? null,
      canCloseP6: report.p6?.canCloseP6 ?? false,
      aiDegradedRate: report.p6?.ai?.degradedRate ?? null,
      d1RetentionRate: report.p6?.retention?.d1RetentionRate ?? null,
      retentionBehaviorEventCount: report.p6?.retention?.retentionBehaviorEventCount ?? null,
    },
    trends: {
      acquisitionDirection: report.trends?.acquisitionTrend?.direction ?? null,
      paymentDirection: report.trends?.paymentTrend?.direction ?? null,
      aiDegradedDirection: report.trends?.aiDegradedTrend?.direction ?? null,
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
    acquisitionOverview,
  ] = await Promise.all([
    getJson(`${BASE_URL}/health`),
    getJson(LEGACY_HEALTH_URL),
    getJson(`${API_BASE}/ai/health`),
    getJson(`${API_BASE}/analytics/funnel?rangeDays=${RANGE_DAYS}`, adminToken),
    getJson(`${API_BASE}/analytics/ai-overview?rangeDays=${RANGE_DAYS}`, adminToken),
    getJson(`${API_BASE}/analytics/activation-overview?rangeDays=${RANGE_DAYS}`, adminToken),
    getJson(`${API_BASE}/analytics/retention-overview?rangeDays=${RANGE_DAYS}`, adminToken),
    getJson(`${API_BASE}/analytics/acquisition-overview?rangeDays=${RANGE_DAYS}`, adminToken),
  ]);

  return {
    health,
    legacyHealth,
    aiHealth,
    funnel,
    aiOverview,
    activationOverview,
    retentionOverview,
    acquisitionOverview,
  };
}

async function main() {
  const adminToken = await login();
  const snapshot = await collectSnapshot(adminToken);
  const p6Report = buildP6DataClosureReport({
    generatedAt: new Date().toISOString(),
    rangeDays: RANGE_DAYS,
    health: snapshot.health,
    legacyHealth: snapshot.legacyHealth,
    aiHealth: snapshot.aiHealth,
    funnel: snapshot.funnel,
    aiOverview: snapshot.aiOverview,
    activationOverview: snapshot.activationOverview,
    retentionOverview: snapshot.retentionOverview,
  });
  const p6HistoryRecords = [
    ...readP6HistoryRecords(),
    buildP6DataClosureHistoryRecord(p6Report),
  ];
  const report = buildP7GrowthReport({
    generatedAt: new Date().toISOString(),
    rangeDays: RANGE_DAYS,
    p6Report,
    acquisitionOverview: snapshot.acquisitionOverview,
    p6HistoryRecords,
  });

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), 'utf8');
  fs.mkdirSync(path.dirname(MARKDOWN_OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(MARKDOWN_OUTPUT_FILE, buildP7GrowthMarkdown(report), 'utf8');
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  fs.appendFileSync(HISTORY_FILE, `${JSON.stringify(buildP7GrowthHistoryRecord(report))}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));

  if (report.status === 'blocker') {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[p7-growth-status] failed:', error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildP7GrowthReport,
  buildP7GrowthMarkdown,
  buildP7GrowthHistoryRecord,
  parseP6HistoryLines,
};

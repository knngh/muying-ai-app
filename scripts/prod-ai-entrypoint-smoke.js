#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || 'https://beihu.me';
const API_BASE = process.env.API_BASE || `${BASE_URL}/api/v1`;
const VIP_USERNAME = process.env.VIP_USERNAME || 'demo_vip_user';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'Test123456!';
const VIP_PASSWORD = process.env.VIP_PASSWORD || DEFAULT_PASSWORD;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
const AI_OVERVIEW_RANGE_DAYS = Number(process.env.AI_OVERVIEW_RANGE_DAYS || 7);
const AI_ENTRYPOINT_SMOKE_WAIT_MS = Number(process.env.AI_ENTRYPOINT_SMOKE_WAIT_MS || 18000);
const AI_ENTRYPOINT_SMOKE_RATE_LIMIT_WAIT_MS = Number(process.env.AI_ENTRYPOINT_SMOKE_RATE_LIMIT_WAIT_MS || 65000);
const TRAFFIC_KIND = 'ops_product_entrypoint_smoke';

const JOURNEYS = [
  {
    entrySource: 'home_suggested_question',
    label: 'Home suggested question',
    clickEventName: 'app_home_suggested_question_click',
    clickPage: 'HomeScreen',
    source: 'home_suggested_question',
    reportId: 'ops-ai-entrypoint-smoke-home',
    question: '宝宝低热但精神还可以，今晚观察要注意哪三件事？',
    context: { entrySource: 'home_suggested_question', stage: 'newborn' },
  },
  {
    entrySource: 'weekly_report',
    label: 'Weekly report AI',
    clickEventName: 'app_weekly_report_ask_ai_click',
    clickPage: 'WeeklyReportScreen',
    source: 'weekly_report',
    reportId: 'ops-ai-entrypoint-smoke-weekly',
    question: '这周宝宝睡眠变化明显，家长应该如何记录和判断？',
    context: { entrySource: 'weekly_report', stage: 'newborn', reportHighlightIndex: 1 },
  },
  {
    entrySource: 'knowledge_detail',
    label: 'Knowledge detail AI',
    clickEventName: 'app_knowledge_detail_ask_ai_click',
    clickPage: 'KnowledgeDetailScreen',
    source: 'knowledge_detail',
    reportId: 'ops-ai-entrypoint-smoke-knowledge-detail',
    question: '读完这篇婴儿喂养内容后，我应该重点问医生什么？',
    context: { entrySource: 'knowledge_detail', stage: 'newborn', articleSlug: 'ops-ai-entrypoint-smoke-article' },
  },
  {
    entrySource: 'knowledge_recent_ai',
    label: 'Knowledge recent AI',
    clickEventName: 'app_knowledge_recent_ai_ask_click',
    clickPage: 'KnowledgeScreen',
    source: 'knowledge_recent_ai',
    reportId: 'ops-ai-entrypoint-smoke-knowledge-recent',
    question: '最近 AI 推荐的主题里，宝宝发热应该优先看哪些权威信息？',
    context: { entrySource: 'knowledge_recent_ai', stage: 'newborn', articleSlug: 'ops-ai-entrypoint-smoke-recent' },
    clickProperties: { targetType: 'topic', topic: 'common-symptoms', displayName: '常见症状' },
  },
  {
    entrySource: 'native',
    label: 'Native chat',
    clickEventName: null,
    clickPage: 'ChatScreen',
    source: 'native',
    reportId: 'ops-ai-entrypoint-smoke-native',
    question: '宝宝今天吃奶少一点但精神正常，今晚怎么观察？',
    context: { entrySource: 'native', stage: 'newborn' },
  },
];

function fail(message) {
  console.error(message);
  process.exit(1);
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

function isRateLimitError(error) {
  return error && typeof error === 'object' && error.status === 429;
}

async function postJsonWithRateLimitRetry(url, body, token) {
  try {
    return await postJson(url, body, token);
  } catch (error) {
    if (!isRateLimitError(error)) {
      throw error;
    }

    const retryAfterMs = Math.max(
      1000,
      Number(error.retryAfterMs) || AI_ENTRYPOINT_SMOKE_RATE_LIMIT_WAIT_MS,
    );
    console.warn(`[ai-entrypoint-smoke] rate limited; retrying after ${retryAfterMs}ms`);
    await sleep(retryAfterMs);
    return postJson(url, body, token);
  }
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
  if (username === VIP_USERNAME && process.env.VIP_TOKEN) {
    return process.env.VIP_TOKEN;
  }
  if (username === ADMIN_USERNAME && process.env.ADMIN_TOKEN) {
    return process.env.ADMIN_TOKEN;
  }

  const json = await postJson(`${API_BASE}/auth/login`, { username, password });
  const token = json?.data?.token;
  if (!token) {
    fail(`Login did not return token for ${username}`);
  }
  return token;
}

async function recordAnalyticsEvent(eventName, page, properties, token) {
  await postJson(`${API_BASE}/analytics/events`, {
    eventName,
    source: 'app',
    page,
    clientId: 'ops-ai-entrypoint-smoke-client',
    sessionId: `ops-ai-entrypoint-smoke-${Date.now()}`,
    properties,
  }, token);
}

async function getAIOverview(adminToken) {
  return getJson(`${API_BASE}/analytics/ai-overview?rangeDays=${AI_OVERVIEW_RANGE_DAYS}`, adminToken);
}

function coverageByEntrypoint(overview, field) {
  const items = overview?.data?.[field] || [];
  return new Map(Array.isArray(items) ? items.map((item) => [item.entrySource, item]) : []);
}

function coverageCount(coverage, entrySource, field) {
  const value = coverage.get(entrySource)?.[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function hasExpectedOpsDelta(beforeCoverage, afterCoverage, journey) {
  const requiredFields = [
    'prefillCount',
    'messageCount',
    'serverStartCount',
    'serverResponseCount',
    ...(journey.clickEventName ? ['clickCount'] : []),
  ];

  return requiredFields.every((field) => (
    coverageCount(afterCoverage, journey.entrySource, field)
      - coverageCount(beforeCoverage, journey.entrySource, field) >= 1
  ));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runJourney(journey, index, vipToken) {
  const clientRequestId = `ops-ai-entrypoint-smoke-${journey.entrySource}-${Date.now()}-${index}`;
  const commonProperties = {
    source: journey.source,
    entrySource: journey.entrySource,
    stage: journey.context.stage,
    reportId: journey.reportId,
    trafficKind: TRAFFIC_KIND,
    questionLength: journey.question.length,
  };

  if (journey.clickEventName) {
    await recordAnalyticsEvent(journey.clickEventName, journey.clickPage, {
      ...commonProperties,
      ...(journey.clickProperties || {}),
    }, vipToken);
  }

  await recordAnalyticsEvent('app_chat_prefill_entry', 'ChatScreen', {
    ...commonProperties,
    autoSend: true,
  }, vipToken);
  await recordAnalyticsEvent('app_chat_message_send', 'ChatScreen', {
    ...commonProperties,
    trigger: 'auto_prefill',
  }, vipToken);

  const response = await postJsonWithRateLimitRetry(`${API_BASE}/ai/ask`, {
    question: journey.question,
    clientRequestId,
    context: {
      ...journey.context,
      reportId: journey.reportId,
      trafficKind: TRAFFIC_KIND,
    },
  }, vipToken);

  return {
    entrySource: journey.entrySource,
    ok: true,
    answerLength: String(response?.data?.answer || '').length,
    degraded: Boolean(response?.data?.degraded),
    provider: response?.data?.provider,
    model: response?.data?.model,
    sourcesCount: Array.isArray(response?.data?.sources) ? response.data.sources.length : 0,
  };
}

async function waitForCoverage(adminToken, beforeOverview) {
  const deadline = Date.now() + AI_ENTRYPOINT_SMOKE_WAIT_MS;
  const beforeOpsCoverage = coverageByEntrypoint(beforeOverview, 'opsProductEntrypointCoverage');
  let latest = null;

  do {
    latest = await getAIOverview(adminToken);
    const coverage = coverageByEntrypoint(latest, 'opsProductEntrypointCoverage');
    const complete = JOURNEYS.every((journey) => hasExpectedOpsDelta(beforeOpsCoverage, coverage, journey));

    if (complete) {
      return latest;
    }

    await sleep(2000);
  } while (Date.now() < deadline);

  return latest;
}

function summarizeCoverage(overview) {
  return {
    productEntrypointCoverage: overview?.data?.productEntrypointCoverage || [],
    opsProductEntrypointCoverage: overview?.data?.opsProductEntrypointCoverage || [],
    serverAi: {
      requestsStarted: overview?.data?.serverAi?.requestsStarted || 0,
      responsesCompleted: overview?.data?.serverAi?.responsesCompleted || 0,
      requestErrors: overview?.data?.serverAi?.requestErrors || 0,
      opsEntrypointSmokeEventCount: overview?.data?.serverAi?.opsEntrypointSmokeEventCount || 0,
      topEntrySources: (overview?.data?.serverAi?.entrySourceBreakdown || []).slice(0, 8),
    },
  };
}

async function main() {
  console.log('[1/4] login');
  const [vipToken, adminToken] = await Promise.all([
    login(VIP_USERNAME, VIP_PASSWORD),
    login(ADMIN_USERNAME, ADMIN_PASSWORD),
  ]);

  console.log('[2/4] ai overview before');
  const before = await getAIOverview(adminToken);
  console.log(JSON.stringify(summarizeCoverage(before), null, 2));

  console.log('[3/4] run product entrypoint journeys');
  const results = [];
  for (const [index, journey] of JOURNEYS.entries()) {
    results.push(await runJourney(journey, index, vipToken));
  }
  console.log(JSON.stringify(results, null, 2));

  console.log('[4/4] ai overview after');
  const after = await waitForCoverage(adminToken, before);
  console.log(JSON.stringify(summarizeCoverage(after), null, 2));

  const beforeOpsCoverage = coverageByEntrypoint(before, 'opsProductEntrypointCoverage');
  const beforeRealCoverage = coverageByEntrypoint(before, 'productEntrypointCoverage');
  const opsCoverage = coverageByEntrypoint(after, 'opsProductEntrypointCoverage');
  const realCoverage = coverageByEntrypoint(after, 'productEntrypointCoverage');
  const missingOps = JOURNEYS.filter((journey) => !hasExpectedOpsDelta(beforeOpsCoverage, opsCoverage, journey));
  const contaminatedReal = JOURNEYS.filter((journey) => {
    return coverageCount(realCoverage, journey.entrySource, 'totalTrackedEvents')
      > coverageCount(beforeRealCoverage, journey.entrySource, 'totalTrackedEvents');
  });

  if (missingOps.length > 0) {
    fail(`Missing ops entrypoint coverage: ${missingOps.map((journey) => journey.entrySource).join(', ')}`);
  }
  if (contaminatedReal.length > 0) {
    fail(`Real entrypoint coverage increased during ops smoke: ${contaminatedReal.map((journey) => journey.entrySource).join(', ')}`);
  }

  console.log('AI product entrypoint smoke completed.');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});

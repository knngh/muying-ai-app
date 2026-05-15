#!/usr/bin/env node

const WebSocket = require('ws');

const BASE_URL = process.env.BASE_URL || 'https://beihu.me';
const API_BASE = process.env.API_BASE || `${BASE_URL}/api/v1`;
const WS_BASE_URL = process.env.WS_BASE_URL || BASE_URL.replace(/^http/i, 'ws');
const WS_URL = process.env.WS_URL || `${WS_BASE_URL}/ws/ai`;
const VIP_USERNAME = process.env.VIP_USERNAME || 'demo_vip_user';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'Test123456!';
const VIP_PASSWORD = process.env.VIP_PASSWORD || DEFAULT_PASSWORD;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
const AI_SMOKE_STAGE = process.env.AI_SMOKE_STAGE || 'newborn';
const AI_SMOKE_QUESTION = process.env.AI_SMOKE_QUESTION || '宝宝低热但精神还可以，今晚观察要注意哪三件事？';
const AI_OVERVIEW_RANGE_DAYS = Number(process.env.AI_OVERVIEW_RANGE_DAYS || 7);
const AI_WS_SMOKE_TIMEOUT_MS = Number(process.env.AI_WS_SMOKE_TIMEOUT_MS || 45000);
const AI_WS_ANALYTICS_WAIT_MS = Number(process.env.AI_WS_ANALYTICS_WAIT_MS || 16000);

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

async function getAIOverview(adminToken) {
  return getJson(`${API_BASE}/analytics/ai-overview?rangeDays=${AI_OVERVIEW_RANGE_DAYS}`, adminToken);
}

function getServerAi(overview) {
  return overview?.data?.serverAi || {};
}

function getCount(overview, path) {
  return path.reduce((value, key) => value?.[key], overview) || 0;
}

function breakdownCount(overview, field, key) {
  const items = getServerAi(overview)?.[field];
  if (!Array.isArray(items)) {
    return 0;
  }
  return items.find((item) => item?.key === key)?.count || 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runWsChatSmoke(vipToken) {
  const requestId = `ops-ai-ws-smoke-${Date.now()}`;
  const startedAt = Date.now();
  const chunks = [];

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(vipToken)}`);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`WebSocket smoke timed out after ${AI_WS_SMOKE_TIMEOUT_MS}ms`));
    }, AI_WS_SMOKE_TIMEOUT_MS);

    socket.on('open', () => {
      socket.send(JSON.stringify({
        type: 'chat_stream',
        requestId,
        payload: {
          messages: [
            { role: 'user', content: AI_SMOKE_QUESTION },
          ],
          context: {
            entrySource: 'ops_ai_smoke',
            stage: AI_SMOKE_STAGE,
            reportId: 'ops-ai-ws-smoke',
          },
        },
      }));
    });

    socket.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(String(raw));
      } catch (error) {
        reject(error);
        socket.close();
        return;
      }

      if (message.requestId !== requestId) {
        return;
      }

      if (message.type === 'chunk') {
        chunks.push(message.data?.content || '');
        return;
      }

      if (message.type === 'error') {
        clearTimeout(timeout);
        socket.close();
        resolve({
          requestId,
          ok: false,
          elapsedMs: Date.now() - startedAt,
          error: message.data?.error,
          code: message.data?.code,
          status: message.data?.status,
        });
        return;
      }

      if (message.type === 'done' || message.type === 'emergency') {
        clearTimeout(timeout);
        socket.close();
        resolve({
          requestId,
          ok: true,
          elapsedMs: Date.now() - startedAt,
          type: message.type,
          answerLength: chunks.join('').length || String(message.data?.content || '').length,
          sourcesCount: Array.isArray(message.data?.sources) ? message.data.sources.length : 0,
          degraded: Boolean(message.data?.degraded),
          provider: message.data?.provider,
          model: message.data?.model,
          route: message.data?.route,
          conversationId: message.data?.conversationId,
        });
      }
    });

    socket.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function waitForAnalytics(adminToken, before) {
  const expectedStarted = getCount(before, ['data', 'serverAi', 'requestsStarted']) + 1;
  const expectedTerminal = getCount(before, ['data', 'serverAi', 'responsesCompleted'])
    + getCount(before, ['data', 'serverAi', 'requestErrors'])
    + 1;
  const expectedChatStream = breakdownCount(before, 'endpointBreakdown', 'chat_stream') + 2;
  const deadline = Date.now() + AI_WS_ANALYTICS_WAIT_MS;
  let after = null;

  do {
    after = await getAIOverview(adminToken);
    const started = getCount(after, ['data', 'serverAi', 'requestsStarted']);
    const terminal = getCount(after, ['data', 'serverAi', 'responsesCompleted'])
      + getCount(after, ['data', 'serverAi', 'requestErrors']);
    const chatStreamCount = breakdownCount(after, 'endpointBreakdown', 'chat_stream');

    if (started >= expectedStarted && terminal >= expectedTerminal && chatStreamCount >= expectedChatStream) {
      return after;
    }

    await sleep(2000);
  } while (Date.now() < deadline);

  return after;
}

function summarizeDelta(before, after) {
  return {
    before: {
      requestsStarted: getCount(before, ['data', 'serverAi', 'requestsStarted']),
      responsesCompleted: getCount(before, ['data', 'serverAi', 'responsesCompleted']),
      requestErrors: getCount(before, ['data', 'serverAi', 'requestErrors']),
      chatStreamEvents: breakdownCount(before, 'endpointBreakdown', 'chat_stream'),
      opsSmokeEvents: breakdownCount(before, 'entrySourceBreakdown', 'ops_ai_smoke'),
    },
    after: {
      requestsStarted: getCount(after, ['data', 'serverAi', 'requestsStarted']),
      responsesCompleted: getCount(after, ['data', 'serverAi', 'responsesCompleted']),
      requestErrors: getCount(after, ['data', 'serverAi', 'requestErrors']),
      chatStreamEvents: breakdownCount(after, 'endpointBreakdown', 'chat_stream'),
      opsSmokeEvents: breakdownCount(after, 'entrySourceBreakdown', 'ops_ai_smoke'),
      topEndpoints: (getServerAi(after).endpointBreakdown || []).slice(0, 5),
      topEntrySources: (getServerAi(after).entrySourceBreakdown || []).slice(0, 5),
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
  console.log(JSON.stringify({
    rangeDays: before?.data?.rangeDays,
    serverAi: {
      requestsStarted: getCount(before, ['data', 'serverAi', 'requestsStarted']),
      responsesCompleted: getCount(before, ['data', 'serverAi', 'responsesCompleted']),
      requestErrors: getCount(before, ['data', 'serverAi', 'requestErrors']),
      chatStreamEvents: breakdownCount(before, 'endpointBreakdown', 'chat_stream'),
      opsSmokeEvents: breakdownCount(before, 'entrySourceBreakdown', 'ops_ai_smoke'),
    },
  }, null, 2));

  console.log('[3/4] websocket chat_stream');
  const result = await runWsChatSmoke(vipToken);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok && result.status && result.status >= 400 && result.status < 500) {
    fail(`WebSocket AI smoke was rejected by the API with status ${result.status}`);
  }

  console.log('[4/4] ai overview after');
  const after = await waitForAnalytics(adminToken, before);
  console.log(JSON.stringify(summarizeDelta(before, after), null, 2));

  const startedDelta = getCount(after, ['data', 'serverAi', 'requestsStarted'])
    - getCount(before, ['data', 'serverAi', 'requestsStarted']);
  const chatStreamDelta = breakdownCount(after, 'endpointBreakdown', 'chat_stream')
    - breakdownCount(before, 'endpointBreakdown', 'chat_stream');
  if (startedDelta < 1 || chatStreamDelta < 2) {
    fail(`WebSocket AI analytics did not increase enough; startedDelta=${startedDelta}, chatStreamDelta=${chatStreamDelta}`);
  }

  console.log('AI WebSocket smoke completed.');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function includesAll(source, patterns) {
  return patterns.every((pattern) => source.includes(pattern));
}

function checkContains(results, relativePath, patterns, description) {
  const source = read(relativePath);
  const missing = patterns.filter((pattern) => !source.includes(pattern));
  if (missing.length > 0) {
    results.failures.push({
      description,
      file: relativePath,
      missing,
    });
    return;
  }

  results.passed.push(description);
}

function checkRegex(results, relativePath, regex, description) {
  const source = read(relativePath);
  if (!regex.test(source)) {
    results.failures.push({
      description,
      file: relativePath,
      missing: [String(regex)],
    });
    return;
  }

  results.passed.push(description);
}

function audit() {
  const results = {
    passed: [],
    warnings: [],
    failures: [],
  };

  checkContains(results, 'mobile/src/services/analytics.ts', [
    'app_home_suggested_question_click',
    'app_weekly_report_ask_ai_click',
    'app_knowledge_detail_ask_ai_click',
    'app_knowledge_recent_ai_ask_click',
    'app_chat_prefill_entry',
    'app_chat_message_send',
    'app_chat_response_receive',
  ], 'mobile analytics allows all AI entrypoint events');

  checkContains(results, 'mobile/src/utils/aiEntryContext.ts', [
    "entrySource: 'home_suggested_question'",
    "entrySource: 'weekly_report'",
    "entrySource: 'knowledge_detail'",
  ], 'mobile entry context builders set canonical entrySource values');

  checkContains(results, 'mobile/src/screens/HomeScreen.tsx', [
    'app_home_suggested_question_click',
    'buildHomeChatContext(stage.lifecycleKey)',
    "source: 'home_suggested_question'",
  ], 'mobile home suggested question click opens chat with context');

  checkContains(results, 'mobile/src/screens/WeeklyReportScreen.tsx', [
    'app_weekly_report_ask_ai_click',
    'buildWeeklyReportChatContext',
    "source: 'weekly_report'",
  ], 'mobile weekly report AI click opens chat with context');

  checkContains(results, 'mobile/src/screens/KnowledgeDetailScreen.tsx', [
    'app_knowledge_detail_ask_ai_click',
    'buildKnowledgeDetailChatContext',
    "source: 'knowledge_detail'",
  ], 'mobile knowledge detail AI click opens chat with context');

  checkContains(results, 'mobile/src/screens/KnowledgeScreen.tsx', [
    'app_knowledge_recent_ai_ask_click',
    "entrySource: 'knowledge_recent_ai'",
    'originEntrySource',
    "source: 'knowledge_recent_ai'",
  ], 'mobile recent AI knowledge actions use canonical entrySource and preserve origin');

  checkContains(results, 'mobile/src/screens/ChatScreen.tsx', [
    'app_chat_prefill_entry',
    'app_chat_message_send',
    'app_chat_response_receive',
    'clientRequestId',
    'uuidv4()',
  ], 'mobile chat emits prefill, send, response analytics with clientRequestId');

  checkContains(results, 'mobile/src/stores/chatStore.ts', [
    'clientRequestId?: string',
    'const requestId = options?.clientRequestId || uuidv4()',
    'clientRequestId: requestId',
    'aiApi.chat',
  ], 'mobile chat store passes clientRequestId through websocket and HTTP fallback');

  checkContains(results, 'mobile/src/components/chat/MessageBubble.tsx', [
    'clientRequestId',
    'uuidv4()',
    'app_chat_message_send',
    'sendMessage(question, undefined, { clientRequestId })',
    'sendMessage(trimmed, undefined, { clientRequestId })',
  ], 'mobile follow-up messages include clientRequestId in analytics and send path');

  checkContains(results, 'shared/types/ai.ts', [
    'clientRequestId?: string',
    "type: 'ask_stream' | 'chat_stream'",
  ], 'shared AI types expose clientRequestId on REST and websocket payloads');

  checkContains(results, 'src/services/websocket.service.ts', [
    'clientRequestId?: string',
    'resolveWsClientRequestId',
    'clientRequestId,',
    'requestId: clientRequestId || requestId',
  ], 'backend websocket analytics and quota use clientRequestId when valid');

  checkContains(results, 'mini-program/src/api/ai.ts', [
    'clientRequestId?: string',
    'clientRequestId: data.clientRequestId',
  ], 'mini-program REST AI API accepts clientRequestId');

  checkContains(results, 'mini-program/src/stores/chat.ts', [
    'const requestId = genRequestId()',
    'clientRequestId: requestId',
  ], 'mini-program websocket AI store passes clientRequestId');

  const miniChat = read('mini-program/src/pages/chat/index.vue');
  if (miniChat.includes('const chatFeatureEnabled = false')) {
    results.warnings.push({
      description: 'mini-program chat UI is still disabled; full chat entrypoint analytics will remain limited until the feature flag is opened',
      file: 'mini-program/src/pages/chat/index.vue',
    });
  } else {
    checkRegex(
      results,
      'mini-program/src/pages/chat/index.vue',
      /trackMiniEvent\(['"]app_chat_message_send['"]/,
      'mini-program chat UI emits app_chat_message_send when enabled',
    );
  }

  const summary = {
    ok: results.failures.length === 0,
    passed: results.passed.length,
    warnings: results.warnings,
    failures: results.failures,
  };

  return summary;
}

function main() {
  const summary = audit();
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.ok) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { audit };

import '../config/env';
import fs from 'fs';
import path from 'path';
import {
  buildAIProviderHealthReport,
  buildAIProviderHealthSuiteReport,
} from '../utils/ai-provider-health';

const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(process.cwd(), 'tmp', 'ai-provider-health-report.json');
const STRICT = process.env.AI_HEALTH_STRICT !== 'false';

function parseTaskRoles(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function main() {
  const taskRoles = parseTaskRoles(process.env.AI_HEALTH_TASK_ROLES);
  const commonOptions = {
    timeoutMs: process.env.AI_HEALTH_TIMEOUT_MS ? Number(process.env.AI_HEALTH_TIMEOUT_MS) : undefined,
    maxTokens: process.env.AI_HEALTH_MAX_TOKENS ? Number(process.env.AI_HEALTH_MAX_TOKENS) : undefined,
    prompt: process.env.AI_HEALTH_PROMPT,
    expectedAnswer: process.env.AI_HEALTH_EXPECTED_ANSWER,
    stopOnPrimaryProviderFailure: process.env.AI_HEALTH_STOP_ON_PRIMARY_PROVIDER_FAILURE !== 'false',
  };
  const report = taskRoles.length > 0
    ? await buildAIProviderHealthSuiteReport({
      ...commonOptions,
      taskRoles,
    })
    : await buildAIProviderHealthReport({
      ...commonOptions,
      taskRole: process.env.AI_HEALTH_TASK_ROLE,
    });

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report, null, 2));

  if (STRICT && report.status !== 'ok') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[AI Provider Health] failed:', error);
  process.exit(1);
});

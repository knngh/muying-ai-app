import '../config/env';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  buildKnowledgeDailyOpsReport,
  type KnowledgeDailyOpsCommandResult,
  type KnowledgeDailyOpsKnowledgeReport,
  type KnowledgeDailyOpsSourceRefreshResult,
  type KnowledgeDailyOpsTranslationCleanupReport,
} from '../utils/knowledge-daily-ops';

const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(process.cwd(), 'tmp', 'knowledge-daily-ops-report.json');
const DAILY_COVERAGE_AUDIT_FILE = process.env.DAILY_COVERAGE_AUDIT_FILE || path.join(process.cwd(), 'tmp', 'knowledge-daily-authority-coverage-audit.json');
const KNOWLEDGE_REPORT_FILE = process.env.KNOWLEDGE_REPORT_FILE || path.join(process.cwd(), 'tmp', 'knowledge-ops-report.json');
const SOURCE_REFRESH_REPORT_FILE = process.env.SOURCE_REFRESH_REPORT_FILE || path.join(process.cwd(), 'tmp', 'knowledge-low-coverage-source-refresh.json');
const TRANSLATION_CLEAN_REPORT_FILE = process.env.TRANSLATION_CLEAN_REPORT_FILE || path.join(process.cwd(), 'tmp', 'authority-translation-cache-clean-report.json');
const APPLY_FIXES = /^true$/i.test(process.env.KNOWLEDGE_DAILY_APPLY_FIXES || '');
const STRICT = /^true$/i.test(process.env.KNOWLEDGE_DAILY_STRICT || '');

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function tailText(value: unknown, maxLength = 2000): string | undefined {
  const text = Buffer.isBuffer(value) ? value.toString('utf-8') : String(value || '');
  const normalized = text.trim();
  return normalized ? normalized.slice(-maxLength) : undefined;
}

function runCommand(name: string, command: string, env: Record<string, string | undefined> = {}): KnowledgeDailyOpsCommandResult {
  const startedAt = Date.now();
  const result = spawnSync(command, {
    shell: true,
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined)),
    },
    encoding: 'utf-8',
  });

  const ok = result.status === 0;
  return {
    name,
    command,
    ok,
    exitCode: result.status,
    durationMs: Date.now() - startedAt,
    error: result.error?.message,
    stdoutTail: ok ? undefined : tailText(result.stdout),
    stderrTail: ok ? undefined : tailText(result.stderr),
  };
}

async function main() {
  const commands: KnowledgeDailyOpsCommandResult[] = [];

  commands.push(runCommand('authority_coverage_audit', 'npm run audit:authority-coverage', {
    OUTPUT_FILE: DAILY_COVERAGE_AUDIT_FILE,
  }));
  commands.push(runCommand('authority_review_summary', 'npm run review:authority -- summary', {
    AUTHORITY_PUBLISH_STATUS: process.env.AUTHORITY_PUBLISH_STATUS || 'review',
    AUTHORITY_REVIEW_SUMMARY_OUTPUT_FILE: process.env.AUTHORITY_REVIEW_SUMMARY_OUTPUT_FILE || path.join(process.cwd(), 'tmp', 'authority-review-summary.json'),
  }));
  commands.push(runCommand('knowledge_ops_report', 'npm run ops:knowledge:report'));

  commands.push(runCommand('low_coverage_source_refresh', 'npm run ops:authority:refresh-low-coverage', {
    DRY_RUN: APPLY_FIXES ? 'false' : 'true',
    OUTPUT_FILE: SOURCE_REFRESH_REPORT_FILE,
  }));
  commands.push(runCommand('authority_translation_cache_clean', 'npm run clean:authority-translation-cache', {
    DRY_RUN: APPLY_FIXES ? 'false' : 'true',
    REPORT_FILE: TRANSLATION_CLEAN_REPORT_FILE,
  }));

  const report = buildKnowledgeDailyOpsReport({
    generatedAt: new Date().toISOString(),
    applyFixes: APPLY_FIXES,
    commands,
    knowledgeReport: readJsonFile<KnowledgeDailyOpsKnowledgeReport>(KNOWLEDGE_REPORT_FILE),
    sourceRefreshResult: readJsonFile<KnowledgeDailyOpsSourceRefreshResult>(SOURCE_REFRESH_REPORT_FILE),
    translationCleanupReport: readJsonFile<KnowledgeDailyOpsTranslationCleanupReport>(TRANSLATION_CLEAN_REPORT_FILE),
  });

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report, null, 2));

  if (STRICT && report.status === 'failed') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[Knowledge Daily Ops] failed:', error);
  process.exit(1);
});

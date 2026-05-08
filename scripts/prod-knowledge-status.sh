#!/usr/bin/env bash

set -euo pipefail

SSH_USER="${SSH_USER:-ubuntu}"
SSH_HOST="${SSH_HOST:-212.64.29.211}"
SSH_PORT="${SSH_PORT:-39022}"
SSH_IDENTITY_FILE="${SSH_IDENTITY_FILE:-}"
SSH_PASSWORD="${SSH_PASSWORD:-}"
APP_DIR="${APP_DIR:-/www/wwwroot/muying-ai-app}"
PM2_API_NAME="${PM2_API_NAME:-muying-api}"
PM2_AUTHORITY_WORKER_NAME="${PM2_AUTHORITY_WORKER_NAME:-muying-authority-worker}"

usage() {
  cat <<'EOF'
Usage:
  scripts/prod-knowledge-status.sh

Env:
  SSH_USER      default: ubuntu
  SSH_HOST      default: 212.64.29.211
  SSH_PORT      default: 39022
  SSH_IDENTITY_FILE optional; local private key path
  SSH_PASSWORD  optional; when set and sshpass exists, use password auth
  APP_DIR       default: /www/wwwroot/muying-ai-app
  PM2_API_NAME  default: muying-api
  PM2_AUTHORITY_WORKER_NAME default: muying-authority-worker
  KNOWLEDGE_STATUS_PROBE_DISCOVERY default: true; probe low-coverage source discovery during dry-run
  AUTHORITY_SOURCE_DRY_RUN_SAMPLE_LIMIT default: 3; sample URL count per probed source
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

run_ssh() {
  local ssh_opts=(-p "${SSH_PORT}" -o StrictHostKeyChecking=no)
  if [[ -n "${SSH_IDENTITY_FILE}" ]]; then
    ssh_opts+=(-i "${SSH_IDENTITY_FILE}")
  fi
  if [[ -n "${SSH_PASSWORD}" ]]; then
    sshpass -p "${SSH_PASSWORD}" ssh "${ssh_opts[@]}" "${SSH_USER}@${SSH_HOST}" "$@"
  else
    ssh_opts+=(-o BatchMode=yes)
    ssh "${ssh_opts[@]}" "${SSH_USER}@${SSH_HOST}" "$@"
  fi
}

if [[ -n "${SSH_PASSWORD}" ]] && ! command -v sshpass >/dev/null 2>&1; then
  echo "SSH_PASSWORD is set but sshpass is not installed." >&2
  exit 1
fi

REMOTE_SCRIPT=$(cat <<'EOF'
set -euo pipefail

cd "${APP_DIR}"

echo "== production app =="
pwd
git log -1 --oneline 2>/dev/null || true

echo
echo "== daily knowledge ops =="
DAILY_OPS_EXIT=0
DAILY_OPS_SUCCEEDED=false
KNOWLEDGE_STATUS_PROBE_DISCOVERY="${KNOWLEDGE_STATUS_PROBE_DISCOVERY:-true}"
AUTHORITY_SOURCE_DRY_RUN_SAMPLE_LIMIT="${AUTHORITY_SOURCE_DRY_RUN_SAMPLE_LIMIT:-3}"
export AUTHORITY_SOURCE_DRY_RUN_SAMPLE_LIMIT
if [[ "${KNOWLEDGE_STATUS_PROBE_DISCOVERY}" == "true" ]]; then
  AUTHORITY_SOURCE_DRY_RUN_PROBE_DISCOVERY="${AUTHORITY_SOURCE_DRY_RUN_PROBE_DISCOVERY:-true}"
  export AUTHORITY_SOURCE_DRY_RUN_PROBE_DISCOVERY
fi
if npm run --silent ops:knowledge:daily >/dev/null; then
  DAILY_OPS_EXIT=0
  DAILY_OPS_SUCCEEDED=true
else
  DAILY_OPS_EXIT=$?
  echo "ops:knowledge:daily failed or is not available; falling back to legacy knowledge status commands."
  npm run --silent audit:authority-coverage >/dev/null || true
  AUTHORITY_PUBLISH_STATUS=review AUTHORITY_REVIEW_SUMMARY_OUTPUT_FILE=tmp/authority-review-summary.json npm run --silent review:authority -- summary >/dev/null || true
  npm run --silent ops:knowledge:report >/dev/null || true
fi
export DAILY_OPS_SUCCEEDED
node <<'NODE'
const fs = require('fs');

function readJson(path) {
  if (!fs.existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

const dailyReportPath = 'tmp/knowledge-daily-ops-report.json';
const legacyReportPath = 'tmp/knowledge-ops-report.json';
const dailyReport = process.env.DAILY_OPS_SUCCEEDED === 'true'
  ? readJson(dailyReportPath)
  : null;
const legacyReport = readJson(legacyReportPath);

if (dailyReport) {
  const failedCommands = (dailyReport.commands?.results || [])
    .filter((command) => !command.ok && !command.skipped)
    .map((command) => ({
      name: command.name,
      exitCode: command.exitCode,
      error: command.error,
      stderrTail: command.stderrTail,
    }));

  console.log(JSON.stringify({
    exists: true,
    path: dailyReportPath,
    generatedAt: dailyReport.generatedAt,
    status: dailyReport.status,
    applyFixes: dailyReport.applyFixes,
    commands: {
      total: dailyReport.commands?.total,
      failed: dailyReport.commands?.failed,
      failedCommands,
    },
    coverage: dailyReport.knowledge?.coverage,
    translations: dailyReport.knowledge?.translations,
    sourceCoverage: dailyReport.knowledge?.sourceCoverage?.watchedSources,
    remediation: {
      sourceRefresh: {
        dryRun: dailyReport.remediation?.sourceRefresh?.dryRun,
        selectedSources: dailyReport.remediation?.sourceRefresh?.selectedSources,
        summaries: dailyReport.remediation?.sourceRefresh?.summaries,
      },
      translationCleanup: dailyReport.remediation?.translationCleanup,
      translationFailureRetry: dailyReport.remediation?.translationFailureRetry,
    },
    actionItems: dailyReport.knowledge?.actionItems,
    nextActions: dailyReport.nextActions,
  }, null, 2));
  process.exit(0);
}

if (!legacyReport) {
  console.log(JSON.stringify({
    daily: { exists: false, path: dailyReportPath },
    legacy: { exists: false, path: legacyReportPath },
  }, null, 2));
  process.exit(0);
}

const report = legacyReport;
console.log(JSON.stringify({
  exists: true,
  path: legacyReportPath,
  generatedAt: report.generatedAt,
  qa: {
    total: report.qa?.total,
    enrichedTotal: report.qa?.enrichedTotal,
  },
  authority: {
    total: report.authority?.total,
    riskDistribution: report.authority?.riskDistribution,
  },
  coverage: {
    total: report.coverage?.total,
    authorityCovered: report.coverage?.authorityCovered,
    missingAuthorityCoverage: report.coverage?.missingAuthorityCoverage,
    coverageRate: report.coverage?.coverageRate,
    missingByCategory: (report.coverage?.missingByCategory || []).slice(0, 8),
  },
  translations: {
    recordsForTranslation: report.translations?.recordsForTranslation,
    cacheEntries: report.translations?.cacheEntries,
    invalidCacheEntries: report.translations?.invalidCacheEntries,
    freshCacheEntries: report.translations?.freshCacheEntries,
    staleCacheEntries: report.translations?.staleCacheEntries,
    failureEntries: report.translations?.failureEntries,
    retryableFailures: report.translations?.retryableFailures,
    blockedFailures: report.translations?.blockedFailures,
    cacheHitRate: report.translations?.cacheHitRate,
  },
  review: {
    layers: report.review?.layers,
  },
  sourceCoverage: report.sourceCoverage?.watchedSources,
  actionItems: report.actionItems,
}, null, 2));
NODE
if [[ "${DAILY_OPS_EXIT}" -ne 0 ]]; then
  echo "daily ops command exit code: ${DAILY_OPS_EXIT}"
fi

echo
echo "== knowledge files =="
node <<'NODE'
const fs = require('fs');

function readJson(path) {
  if (!fs.existsSync(path)) {
    return { exists: false };
  }

  const stat = fs.statSync(path);
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  const total = Array.isArray(data) ? data.length : Object.keys(data || {}).length;

  return {
    exists: true,
    total,
    bytes: stat.size,
    mtime: stat.mtime.toISOString(),
  };
}

function topBy(items, keyFn, limit = 10) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function readArray(path) {
  if (!fs.existsSync(path)) {
    return [];
  }
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  return Array.isArray(data) ? data : [];
}

const qa = readArray('data/expanded-qa-data-5000.json');
const authority = readArray('data/authority-knowledge-cache.json');

console.log(JSON.stringify({
  files: {
    qa: readJson('data/expanded-qa-data-5000.json'),
    qaEnriched: readJson('data/expanded-qa-data-5000.enriched.json'),
    authority: readJson('data/authority-knowledge-cache.json'),
    translations: readJson('data/authority-translation-cache.json'),
    translationFailures: readJson('data/authority-translation-failures.json'),
    qaCleanReport: readJson('tmp/expanded-qa-data-5000.clean-report.json'),
    authorityCoverageAudit: readJson('tmp/authority-coverage-audit.json'),
    authorityReviewSummary: readJson('tmp/authority-review-summary.json'),
    knowledgeOpsReport: readJson('tmp/knowledge-ops-report.json'),
  },
  qa: {
    total: qa.length,
    verified: qa.filter((item) => item.is_verified === true).length,
    topCategories: topBy(qa, (item) => item.category),
    topSources: topBy(qa, (item) => item.source),
  },
  authority: {
    total: authority.length,
    official: authority.filter((item) => item.source_class === 'official').length,
    verified: authority.filter((item) => item.is_verified === true).length,
    topTopics: topBy(authority, (item) => item.topic || item.category),
    topSources: topBy(authority, (item) => item.source_org || item.source || item.source_id),
  },
}, null, 2));
NODE

echo
echo "== pm2 =="
pm2 list

echo
echo "== authority worker env =="
WORKER_PM2_ID="$(pm2 jlist | node -e "
let raw = '';
process.stdin.on('data', (chunk) => raw += chunk);
process.stdin.on('end', () => {
  const list = JSON.parse(raw || '[]');
  const worker = list.find((item) => item.name === '${PM2_AUTHORITY_WORKER_NAME}');
  if (worker) process.stdout.write(String(worker.pm_id));
});
")"
if [[ -n "${WORKER_PM2_ID}" ]]; then
  pm2 env "${WORKER_PM2_ID}" 2>/dev/null | grep -E '^(AUTHORITY_SYNC|AUTHORITY_TRANSLATION|NODE_ENV)' || true
else
  echo "authority worker not found: ${PM2_AUTHORITY_WORKER_NAME}"
fi

echo
echo "== recent authority worker logs =="
pm2 logs "${PM2_AUTHORITY_WORKER_NAME}" --lines 60 --nostream || true

echo
echo "== review queue sample =="
AUTHORITY_PUBLISH_STATUS=review AUTHORITY_REVIEW_LIMIT=10 npm run review:authority -- list
EOF
)

REMOTE_SCRIPT="${REMOTE_SCRIPT//\$\{APP_DIR\}/${APP_DIR}}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//\$\{PM2_AUTHORITY_WORKER_NAME\}/${PM2_AUTHORITY_WORKER_NAME}}"

run_ssh "bash -lc $(printf '%q' "${REMOTE_SCRIPT}")"

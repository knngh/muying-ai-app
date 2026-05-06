import '../config/env';
import fs from 'fs';
import path from 'path';
import {
  buildKnowledgeOpsReport,
  type KnowledgeOpsCoverageAudit,
  type KnowledgeOpsFileStat,
  type KnowledgeOpsQaRecord,
  type KnowledgeOpsTranslationCacheRecord,
  type KnowledgeOpsTranslationFailureRecord,
} from '../utils/knowledge-ops-report';

const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(process.cwd(), 'tmp', 'knowledge-ops-report.json');
const SAMPLE_LIMIT = Math.max(1, Number(process.env.SAMPLE_LIMIT || 20));

function resolveFilePath(candidates: string[]): string {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function describeJsonFile(filePath: string): KnowledgeOpsFileStat {
  if (!fs.existsSync(filePath)) {
    return {
      path: filePath,
      exists: false,
    };
  }

  const stat = fs.statSync(filePath);
  const data = readJsonFile<unknown>(filePath, null);
  const total = Array.isArray(data) ? data.length : (data && typeof data === 'object' ? Object.keys(data as Record<string, unknown>).length : 0);

  return {
    path: filePath,
    exists: true,
    total,
    bytes: stat.size,
    mtime: stat.mtime.toISOString(),
  };
}

function resolveInputFiles() {
  const qa = resolveFilePath([
    path.join(process.cwd(), 'data', 'expanded-qa-data-5000.json'),
    '/tmp/expanded-qa-data-5000.json',
  ]);
  const enrichedQa = resolveFilePath([
    path.join(process.cwd(), 'data', 'expanded-qa-data-5000.enriched.json'),
    '/tmp/expanded-qa-data-5000.enriched.json',
  ]);
  const authority = resolveFilePath([
    path.join(process.cwd(), 'data', 'authority-knowledge-cache.json'),
    '/tmp/authority-knowledge-cache.json',
  ]);
  const translations = resolveFilePath([
    path.join(process.cwd(), 'data', 'authority-translation-cache.json'),
    '/tmp/authority-translation-cache.json',
  ]);
  const failures = resolveFilePath([
    path.join(process.cwd(), 'data', 'authority-translation-failures.json'),
    '/tmp/authority-translation-failures.json',
  ]);
  const coverageAudit = resolveFilePath([
    path.join(process.cwd(), 'tmp', 'authority-coverage-audit.json'),
    '/tmp/authority-coverage-audit.json',
  ]);
  const reviewSummary = resolveFilePath([
    path.join(process.cwd(), 'tmp', 'authority-review-summary.json'),
    '/tmp/authority-review-summary.json',
  ]);

  return {
    qa,
    enrichedQa,
    authority,
    translations,
    failures,
    coverageAudit,
    reviewSummary,
  };
}

async function main() {
  const files = resolveInputFiles();
  const qaRecords = readJsonFile<KnowledgeOpsQaRecord[]>(files.qa, []);
  const enrichedQaRecords = files.enrichedQa === files.qa
    ? []
    : readJsonFile<KnowledgeOpsQaRecord[]>(files.enrichedQa, []);
  const authorityRecords = readJsonFile<KnowledgeOpsQaRecord[]>(files.authority, []);
  const translationCache = readJsonFile<Record<string, KnowledgeOpsTranslationCacheRecord>>(files.translations, {});
  const translationFailures = readJsonFile<Record<string, KnowledgeOpsTranslationFailureRecord>>(files.failures, {});
  const coverageAudit = readJsonFile<KnowledgeOpsCoverageAudit | null>(files.coverageAudit, null);
  const reviewQueueSummary = readJsonFile<unknown>(files.reviewSummary, null);

  const report = buildKnowledgeOpsReport(
    {
      qaRecords,
      enrichedQaRecords,
      authorityRecords,
      translationCache,
      translationFailures,
      coverageAudit,
      reviewQueueSummary,
    },
    {
      sampleLimit: SAMPLE_LIMIT,
      fileStats: {
        qa: describeJsonFile(files.qa),
        enrichedQa: describeJsonFile(files.enrichedQa),
        authority: describeJsonFile(files.authority),
        translations: describeJsonFile(files.translations),
        translationFailures: describeJsonFile(files.failures),
        coverageAudit: describeJsonFile(files.coverageAudit),
        reviewSummary: describeJsonFile(files.reviewSummary),
      },
    },
  );

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Knowledge Ops Report] failed:', error);
    process.exit(1);
  });

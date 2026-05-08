import '../config/env';
import fs from 'fs';
import path from 'path';
import {
  findAuthorityRecordForTranslationBySlug,
  resolveAuthorityTranslationSourceUpdatedAt,
  warmPublishedAuthorityTranslations,
} from '../services/authority-translation.service';
import {
  buildAuthorityTranslationFailureRetryPlan,
  isAuthorityTranslationFailureRetrySourceMatch,
  type AuthorityTranslationFailureRecord,
  type AuthorityTranslationFailureRetryCandidate,
} from '../utils/authority-translation-failure-retry';

const INPUT_FILE = process.env.INPUT_FILE || path.join(process.cwd(), 'data', 'authority-translation-failures.json');
const REPORT_FILE = process.env.REPORT_FILE || path.join(process.cwd(), 'tmp', 'authority-translation-failure-retry-report.json');
const DRY_RUN = process.env.DRY_RUN !== 'false';

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function readFailureCache(filePath: string): Record<string, AuthorityTranslationFailureRecord> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, AuthorityTranslationFailureRecord>
    : {};
}

async function main() {
  const failures = readFailureCache(INPUT_FILE);
  const retryLimit = parseNonNegativeInt(process.env.LIMIT || process.env.AUTHORITY_TRANSLATION_FAILURE_RETRY_LIMIT, 5);
  const rawPlan = buildAuthorityTranslationFailureRetryPlan(failures, {
    limit: Number.MAX_SAFE_INTEGER,
    includeBlocked: /^true$/i.test(process.env.INCLUDE_BLOCKED || ''),
    slug: process.env.SLUG?.trim() || undefined,
  });
  const selectedFailures: AuthorityTranslationFailureRetryCandidate[] = [];
  const skippedFailures: AuthorityTranslationFailureRetryCandidate[] = [...rawPlan.skippedFailures];

  for (const candidate of rawPlan.selectedFailures) {
    const found = await findAuthorityRecordForTranslationBySlug(candidate.slug);
    if (!found) {
      skippedFailures.push({
        ...candidate,
        skipReason: 'authority_record_not_found',
      });
      continue;
    }

    const currentSourceUpdatedAt = resolveAuthorityTranslationSourceUpdatedAt(found.record);
    if (!isAuthorityTranslationFailureRetrySourceMatch(candidate.sourceUpdatedAt, currentSourceUpdatedAt)) {
      skippedFailures.push({
        ...candidate,
        currentSourceUpdatedAt,
        skipReason: 'source_updated_at_mismatch',
      });
      continue;
    }

    const matchedCandidate = {
      ...candidate,
      currentSourceUpdatedAt,
    };
    if (selectedFailures.length < retryLimit) {
      selectedFailures.push(matchedCandidate);
    } else {
      skippedFailures.push(matchedCandidate);
    }
  }

  const plan = {
    ...rawPlan,
    limit: retryLimit,
    selectedFailures,
    skippedFailures,
  };

  const retried: Array<{ slug: string; ok: boolean; message?: string; cleared?: boolean }> = [];

  if (!DRY_RUN) {
    for (const candidate of plan.selectedFailures) {
      try {
        const result = await warmPublishedAuthorityTranslations({
          limit: 1,
          delayMs: 0,
          sourceLanguage: 'all',
          slug: candidate.slug,
        });
        if (result.warmed <= 0 && result.cached <= 0) {
          retried.push({
            slug: candidate.slug,
            ok: false,
            message: result.failures[0]?.message || 'authority record not found or not selected for retry',
          });
          continue;
        }

        retried.push({
          slug: candidate.slug,
          ok: true,
          cleared: true,
        });
      } catch (error) {
        retried.push({
          slug: candidate.slug,
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const report = {
    ...plan,
    inputFile: INPUT_FILE,
    reportFile: REPORT_FILE,
    dryRun: DRY_RUN,
    retried,
    retrySucceeded: retried.filter((item) => item.ok).length,
    retryFailed: retried.filter((item) => !item.ok).length,
  };

  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error('[Authority Translation Failure Retry] failed:', error);
    process.exit(1);
  });

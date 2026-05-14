import '../config/env';
import fs from 'fs';
import path from 'path';
import { cleanAuthorityTranslationCache } from '../utils/authority-translation-cache-cleaner';
import {
  buildAuthorityTranslationSourceFingerprint,
  isAuthorityTranslationCacheFresh,
  resolveAuthorityTranslationSourceUpdatedAt,
  type AuthorityTranslationSourceInput,
} from '../utils/authority-translation-source';
import {
  buildAuthoritySlug,
  getAuthorityRecordsForTranslation,
  type AuthorityTranslationCacheRecord,
} from '../services/authority-translation.service';
import { buildAuthorityTranslationFailureRetryPlan } from '../utils/authority-translation-failure-retry';

interface TranslationFailureEntry {
  slug?: string;
  sourceUpdatedAt?: string;
  message?: string;
  attempts?: number;
  failedAt?: string;
  retryAfterAt?: string;
}

const INPUT_FILE = process.env.INPUT_FILE || path.join(process.cwd(), 'data', 'authority-translation-cache.json');
const FAILURE_FILE = process.env.FAILURE_FILE || path.join(process.cwd(), 'data', 'authority-translation-failures.json');
const REPORT_FILE = process.env.REPORT_FILE || path.join(process.cwd(), 'tmp', 'authority-translation-cache-repair-report.json');
const DRY_RUN = process.env.DRY_RUN !== 'false';
const PRUNE_REPAIRED_FAILURES = /^true$/i.test(process.env.PRUNE_REPAIRED_FAILURES || '');

function readJsonObject<T>(filePath: string, fallback: Record<string, T> = {}): Record<string, T> {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, T>
    : fallback;
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function main() {
  const cache = readJsonObject<AuthorityTranslationCacheRecord>(INPUT_FILE);
  const failures = readJsonObject<TranslationFailureEntry>(FAILURE_FILE);
  const cleanResult = cleanAuthorityTranslationCache(cache);
  const records = await getAuthorityRecordsForTranslation();
  const recordsBySlug = new Map<string, {
    record: AuthorityTranslationSourceInput;
    sourceUpdatedAt?: string;
    sourceFingerprint: string;
  }>();

  records.forEach((record, index) => {
    recordsBySlug.set(buildAuthoritySlug(record, index), {
      record,
      sourceUpdatedAt: resolveAuthorityTranslationSourceUpdatedAt(record),
      sourceFingerprint: buildAuthorityTranslationSourceFingerprint(record),
    });
  });

  const cleanCache = cleanResult.cleanedCache as Record<string, AuthorityTranslationCacheRecord>;
  const repairedCache: Record<string, AuthorityTranslationCacheRecord> = { ...cleanCache };
  const repairedEntries: Array<{
    slug: string;
    previousSourceUpdatedAt?: string;
    currentSourceUpdatedAt?: string;
    addedFingerprint: boolean;
    timestampRepaired: boolean;
  }> = [];
  const alreadyFresh: string[] = [];
  const staleEntries: Array<{ slug: string; reason: string; title?: string }> = [];
  const missingAuthorityRecords: string[] = [];

  for (const [slug, entry] of Object.entries(cleanCache)) {
    const current = recordsBySlug.get(slug);
    if (!current) {
      missingAuthorityRecords.push(slug);
      continue;
    }

    if (isAuthorityTranslationCacheFresh(entry, current)) {
      alreadyFresh.push(slug);
      const repairedEntry = {
        ...entry,
        sourceUpdatedAt: current.sourceUpdatedAt || entry.sourceUpdatedAt,
        sourceFingerprint: current.sourceFingerprint,
      };
      if (
        repairedEntry.sourceUpdatedAt !== entry.sourceUpdatedAt
        || repairedEntry.sourceFingerprint !== entry.sourceFingerprint
      ) {
        repairedCache[slug] = repairedEntry;
        repairedEntries.push({
          slug,
          previousSourceUpdatedAt: entry.sourceUpdatedAt,
          currentSourceUpdatedAt: current.sourceUpdatedAt,
          addedFingerprint: repairedEntry.sourceFingerprint !== entry.sourceFingerprint,
          timestampRepaired: repairedEntry.sourceUpdatedAt !== entry.sourceUpdatedAt,
        });
      }
      continue;
    }

    if (!entry.sourceFingerprint && entry.sourceUpdatedAt) {
      repairedCache[slug] = {
        ...entry,
        sourceUpdatedAt: current.sourceUpdatedAt || entry.sourceUpdatedAt,
        sourceFingerprint: current.sourceFingerprint,
      };
      repairedEntries.push({
        slug,
        previousSourceUpdatedAt: entry.sourceUpdatedAt,
        currentSourceUpdatedAt: current.sourceUpdatedAt,
        addedFingerprint: true,
        timestampRepaired: current.sourceUpdatedAt !== entry.sourceUpdatedAt,
      });
      continue;
    }

    staleEntries.push({
      slug,
      reason: entry.sourceFingerprint ? 'source_fingerprint_mismatch' : 'missing_source_fingerprint',
      title: current.record.question,
    });
  }

  const prunedFailures: Array<{ slug: string; sourceUpdatedAt?: string; reason: string }> = [];
  if (PRUNE_REPAIRED_FAILURES && Object.keys(failures).length > 0) {
    const freshCacheSlugs = new Set([
      ...alreadyFresh,
      ...repairedEntries.map((entry) => entry.slug),
    ]);
    const retryPlan = buildAuthorityTranslationFailureRetryPlan(failures, {
      limit: Number.MAX_SAFE_INTEGER,
      includeBlocked: true,
    });
    const nextFailures = { ...failures };
    for (const candidate of [...retryPlan.selectedFailures, ...retryPlan.skippedFailures]) {
      if (!freshCacheSlugs.has(candidate.slug)) {
        continue;
      }

      const repaired = repairedCache[candidate.slug];
      if (!repaired || !isAuthorityTranslationCacheFresh(repaired, recordsBySlug.get(candidate.slug) || {})) {
        continue;
      }

      delete nextFailures[candidate.slug];
      prunedFailures.push({
        slug: candidate.slug,
        sourceUpdatedAt: candidate.sourceUpdatedAt,
        reason: 'translation_cache_repaired',
      });
    }

    if (!DRY_RUN && prunedFailures.length > 0) {
      writeJson(FAILURE_FILE, nextFailures);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    inputFile: INPUT_FILE,
    failureFile: FAILURE_FILE,
    reportFile: REPORT_FILE,
    dryRun: DRY_RUN,
    pruneRepairedFailures: PRUNE_REPAIRED_FAILURES,
    cacheEntries: Object.keys(cache).length,
    validCacheEntries: cleanResult.kept,
    invalidCacheEntries: cleanResult.removed,
    authorityRecordsForTranslation: records.length,
    alreadyFresh: alreadyFresh.length,
    repaired: repairedEntries.length,
    stale: staleEntries.length,
    missingAuthorityRecords: missingAuthorityRecords.length,
    prunedFailures: prunedFailures.length,
    samples: {
      repaired: repairedEntries.slice(0, 20),
      stale: staleEntries.slice(0, 20),
      missingAuthorityRecords: missingAuthorityRecords.slice(0, 20),
      invalidCacheEntries: cleanResult.removedEntries.slice(0, 20),
      prunedFailures: prunedFailures.slice(0, 20),
    },
  };

  if (!DRY_RUN && repairedEntries.length > 0) {
    writeJson(INPUT_FILE, repairedCache);
  }
  writeJson(REPORT_FILE, report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('[Authority Translation Cache Repair] failed:', error);
  process.exit(1);
});

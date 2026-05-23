import '../config/env';
import fs from 'fs';
import path from 'path';
import {
  cleanAuthorityTranslationCache,
  type AuthorityTranslationCacheEntry,
} from '../utils/authority-translation-cache-cleaner';

const INPUT_FILE = process.env.INPUT_FILE || path.join(process.cwd(), 'data', 'authority-translation-cache.json');
const EXTRA_INPUT_FILES = (process.env.EXTRA_INPUT_FILES || '/tmp/authority-translation-cache.json')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const REPORT_FILE = process.env.REPORT_FILE || path.join(process.cwd(), 'tmp', 'authority-translation-cache-clean-report.json');
const DRY_RUN = process.env.DRY_RUN !== 'false';

function readTranslationCache(filePath: string): Record<string, AuthorityTranslationCacheEntry> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, AuthorityTranslationCacheEntry>
    : {};
}

async function main() {
  const inputFiles = Array.from(new Set([INPUT_FILE, ...EXTRA_INPUT_FILES]));
  const fileResults = inputFiles
    .filter((filePath) => fs.existsSync(filePath) || filePath === INPUT_FILE)
    .map((filePath) => ({
      filePath,
      result: cleanAuthorityTranslationCache(readTranslationCache(filePath)),
    }));
  const primary = fileResults.find((item) => item.filePath === INPUT_FILE) || fileResults[0] || {
    filePath: INPUT_FILE,
    result: cleanAuthorityTranslationCache({}),
  };
  const report = {
    generatedAt: new Date().toISOString(),
    inputFile: INPUT_FILE,
    inputFiles: fileResults.map((item) => ({
      inputFile: item.filePath,
      total: item.result.total,
      kept: item.result.kept,
      removed: item.result.removed,
      normalized: item.result.normalizedEntries.length,
      removedEntries: item.result.removedEntries,
      normalizedEntries: item.result.normalizedEntries,
    })),
    reportFile: REPORT_FILE,
    dryRun: DRY_RUN,
    total: primary.result.total,
    kept: primary.result.kept,
    removed: fileResults.reduce((total, item) => total + item.result.removed, 0),
    normalized: fileResults.reduce((total, item) => total + item.result.normalizedEntries.length, 0),
    removedEntries: fileResults.flatMap((item) => item.result.removedEntries.map((entry) => ({
      ...entry,
      inputFile: item.filePath,
    }))),
    normalizedEntries: fileResults.flatMap((item) => item.result.normalizedEntries.map((entry) => ({
      ...entry,
      inputFile: item.filePath,
    }))),
  };

  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');

  if (!DRY_RUN) {
    for (const item of fileResults) {
      if (item.result.removed <= 0 && item.result.normalizedEntries.length <= 0) {
        continue;
      }
      fs.mkdirSync(path.dirname(item.filePath), { recursive: true });
      fs.writeFileSync(item.filePath, JSON.stringify(item.result.cleanedCache, null, 2), 'utf-8');
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Authority Translation Cache Clean] failed:', error);
    process.exit(1);
  });

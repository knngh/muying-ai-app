import '../config/env';
import fs from 'fs';
import path from 'path';
import {
  cleanAuthorityTranslationCache,
  type AuthorityTranslationCacheEntry,
} from '../utils/authority-translation-cache-cleaner';

const INPUT_FILE = process.env.INPUT_FILE || path.join(process.cwd(), 'data', 'authority-translation-cache.json');
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
  const cache = readTranslationCache(INPUT_FILE);
  const result = cleanAuthorityTranslationCache(cache);
  const report = {
    generatedAt: new Date().toISOString(),
    inputFile: INPUT_FILE,
    reportFile: REPORT_FILE,
    dryRun: DRY_RUN,
    total: result.total,
    kept: result.kept,
    removed: result.removed,
    removedEntries: result.removedEntries,
  };

  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');

  if (!DRY_RUN && result.removed > 0) {
    fs.mkdirSync(path.dirname(INPUT_FILE), { recursive: true });
    fs.writeFileSync(INPUT_FILE, JSON.stringify(result.cleanedCache, null, 2), 'utf-8');
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Authority Translation Cache Clean] failed:', error);
    process.exit(1);
  });

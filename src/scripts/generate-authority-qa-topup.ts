import fs from 'fs';
import path from 'path';
import {
  generateAuthorityQaTopup,
  type AuthorityTranslationCache,
} from '../utils/authority-qa-topup';
import type { QAPair } from '../services/knowledge.service';

const INPUT_FILE = process.env.INPUT_FILE || path.join(process.cwd(), 'data', 'expanded-qa-data-5000.json');
const AUTHORITY_CACHE_FILE = process.env.AUTHORITY_CACHE_FILE || path.join(process.cwd(), 'data', 'authority-knowledge-cache.json');
const TRANSLATION_CACHE_FILE = process.env.TRANSLATION_CACHE_FILE || path.join(process.cwd(), 'data', 'authority-translation-cache.json');
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(process.cwd(), 'tmp', 'expanded-qa-data-5000.topup.json');
const REPORT_FILE = process.env.REPORT_FILE || path.join(process.cwd(), 'tmp', 'expanded-qa-data-5000.topup-report.json');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'tmp', 'knowledge-backups');
const TARGET_COUNT = Number(process.env.TARGET_COUNT || 5000);
const MAX_GENERATED_PER_AUTHORITY = Number(process.env.MAX_GENERATED_PER_AUTHORITY || 7);
const WRITE_BACK = process.env.WRITE_BACK === 'true';
const REQUIRE_OFFICIAL_SOURCE = process.env.REQUIRE_OFFICIAL_SOURCE !== 'false';
const REQUIRE_CHINESE_MATERIAL = process.env.REQUIRE_CHINESE_MATERIAL !== 'false';

function readJsonArray<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array: ${filePath}`);
  }

  return parsed as T[];
}

function readJsonObject<T extends Record<string, unknown>>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    return {} as T;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Expected JSON object: ${filePath}`);
  }

  return parsed as T;
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath: string, payload: unknown): void {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function buildBackupPath(filePath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(BACKUP_DIR, `${path.basename(filePath)}.${timestamp}.bak`);
}

function backupFile(filePath: string): string {
  const backupPath = buildBackupPath(filePath);
  ensureParentDir(backupPath);
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function main(): void {
  const existingRecords = readJsonArray<QAPair>(INPUT_FILE);
  const authorityRecords = readJsonArray<QAPair>(AUTHORITY_CACHE_FILE);
  const translationCache = readJsonObject<AuthorityTranslationCache>(TRANSLATION_CACHE_FILE);
  const result = generateAuthorityQaTopup(existingRecords, authorityRecords, translationCache, {
    targetCount: TARGET_COUNT,
    requireOfficialSource: REQUIRE_OFFICIAL_SOURCE,
    requireChineseMaterial: REQUIRE_CHINESE_MATERIAL,
    maxGeneratedPerAuthority: MAX_GENERATED_PER_AUTHORITY,
  });

  const backupPath = WRITE_BACK ? backupFile(INPUT_FILE) : null;
  writeJson(OUTPUT_FILE, result.records);
  if (WRITE_BACK) {
    writeJson(INPUT_FILE, result.records);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    inputFile: INPUT_FILE,
    authorityCacheFile: AUTHORITY_CACHE_FILE,
    translationCacheFile: TRANSLATION_CACHE_FILE,
    outputFile: OUTPUT_FILE,
    reportFile: REPORT_FILE,
    writeBack: WRITE_BACK,
    backupPath,
    requireOfficialSource: REQUIRE_OFFICIAL_SOURCE,
    requireChineseMaterial: REQUIRE_CHINESE_MATERIAL,
    maxGeneratedPerAuthority: MAX_GENERATED_PER_AUTHORITY,
    ...result.report,
  };

  writeJson(REPORT_FILE, report);
  console.log(JSON.stringify(report, null, 2));
}

main();

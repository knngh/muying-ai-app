import fs from 'fs';
import path from 'path';
import {
  DEFAULT_KNOWLEDGE_ENRICHMENT_TARGET_CATEGORIES,
  enrichKnowledgeBaseRecords,
} from '../utils/knowledge-enrichment';
import type { QAPair } from '../services/knowledge.service';

const INPUT_FILE = process.env.INPUT_FILE || path.join(process.cwd(), 'data', 'expanded-qa-data-5000.json');
const AUTHORITY_CACHE_FILE = process.env.AUTHORITY_CACHE_FILE || path.join(process.cwd(), 'data', 'authority-knowledge-cache.json');
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(process.cwd(), 'data', 'expanded-qa-data-5000.enriched.json');
const REPORT_FILE = process.env.REPORT_FILE || path.join(process.cwd(), 'tmp', 'expanded-qa-data-5000.enrich-report.json');
const TARGET_CATEGORIES = parseList(process.env.TARGET_CATEGORIES || DEFAULT_KNOWLEDGE_ENRICHMENT_TARGET_CATEGORIES.join(','));
const MAX_REFERENCES = Number(process.env.MAX_REFERENCES || 1);
const MIN_SCORE = Number(process.env.MIN_SCORE || 34);
const REQUIRE_OFFICIAL_REFERENCE = process.env.REQUIRE_OFFICIAL_REFERENCE !== 'false';

function parseList(input: string): string[] {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readJsonArray<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!Array.isArray(data)) {
    throw new Error(`Expected JSON array: ${filePath}`);
  }

  return data as T[];
}

function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath: string, payload: unknown) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function main() {
  const qaRecords = readJsonArray<QAPair>(INPUT_FILE);
  const authorityRecords = readJsonArray<QAPair>(AUTHORITY_CACHE_FILE);
  const result = enrichKnowledgeBaseRecords(qaRecords, authorityRecords, {
    targetCategories: TARGET_CATEGORIES,
    maxReferencesPerItem: MAX_REFERENCES,
    minScore: MIN_SCORE,
    requireOfficialReference: REQUIRE_OFFICIAL_REFERENCE,
  });

  writeJson(OUTPUT_FILE, result.records);
  writeJson(REPORT_FILE, {
    generatedAt: new Date().toISOString(),
    inputFile: INPUT_FILE,
    authorityCacheFile: AUTHORITY_CACHE_FILE,
    outputFile: OUTPUT_FILE,
    reportFile: REPORT_FILE,
    minScore: MIN_SCORE,
    maxReferences: MAX_REFERENCES,
    requireOfficialReference: REQUIRE_OFFICIAL_REFERENCE,
    ...result.report,
  });

  console.log(JSON.stringify({
    inputFile: INPUT_FILE,
    authorityCacheFile: AUTHORITY_CACHE_FILE,
    outputFile: OUTPUT_FILE,
    reportFile: REPORT_FILE,
    ...result.report,
  }, null, 2));
}

main();

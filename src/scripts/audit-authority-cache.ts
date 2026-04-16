import fs from 'fs';
import path from 'path';
import { sanitizeAuthorityTitle } from '../services/authority-adapters/base.adapter';
import { shouldFilterAuthoritySourceUrl } from '../utils/authority-source-url';

interface AuthorityCacheRecord {
  question?: string;
  title?: string;
  source?: string;
  source_org?: string;
  source_id?: string;
  source_url?: string;
  url?: string;
  answer?: string;
  summary?: string;
}

const INPUT_FILE = process.env.INPUT_FILE || path.join(process.cwd(), 'data', 'authority-knowledge-cache.json');
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(process.cwd(), 'tmp', 'authority-cache-audit.json');
const WRITE_CLEANED = /^true$/i.test(process.env.WRITE_CLEANED || '');
const CLEANED_FILE = process.env.CLEANED_FILE || path.join(process.cwd(), 'tmp', 'authority-knowledge-cache.cleaned.json');

function normalizeQuestion(record: AuthorityCacheRecord): string {
  return sanitizeAuthorityTitle(record.question || record.title || '');
}

function getSourceName(record: AuthorityCacheRecord): string {
  return record.source_org || record.source || record.source_id || 'unknown';
}

function getUrl(record: AuthorityCacheRecord): string {
  return record.source_url || record.url || '';
}

function isAapSource(record: AuthorityCacheRecord): boolean {
  return /\baap\b|healthychildren\.org/i.test(`${getSourceName(record)} ${getUrl(record)}`);
}

function extractAapArticleBody(content: string): string {
  if (!content) {
    return '';
  }

  let normalized = content.replace(/\s+/g, ' ').trim().replace(/^-->\s*/, '');
  const pageContentMatch = normalized.match(/\bPage Content\b\s*([\s\S]*?)(?:\bArticle Body\b|\bLast Updated\b|\bFollow Us\b|$)/i);
  if (pageContentMatch?.[1]) {
    normalized = pageContentMatch[1].trim();
  }

  return normalized.replace(/\b(?:Article Body|Last Updated|Follow Us)\b[\s\S]*$/i, '').trim();
}

function normalizeRecord(record: AuthorityCacheRecord): AuthorityCacheRecord {
  const question = normalizeQuestion(record) || record.question || record.title || '';
  let answer = typeof record.answer === 'string' ? record.answer.trim() : '';
  let summary = typeof record.summary === 'string' ? record.summary.trim() : '';

  if (isAapSource(record)) {
    const cleanedAnswer = extractAapArticleBody(answer);
    if (cleanedAnswer.length >= 150) {
      answer = cleanedAnswer;
    }

    const cleanedSummary = extractAapArticleBody(summary);
    summary = cleanedSummary || answer.slice(0, 300) || summary;
  }

  return {
    ...record,
    question,
    answer,
    summary,
  };
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Authority cache not found: ${INPUT_FILE}`);
  }

  const raw = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8')) as AuthorityCacheRecord[];
  const records = Array.isArray(raw) ? raw : [];
  const normalized = records.map(normalizeRecord);
  const filtered = normalized.filter((record) => !shouldFilterAuthoritySourceUrl(record));

  const removed = normalized.filter((record) => shouldFilterAuthoritySourceUrl(record));
  const report = {
    generatedAt: new Date().toISOString(),
    inputFile: INPUT_FILE,
    total: records.length,
    kept: filtered.length,
    removed: removed.length,
    removedBySource: Object.entries(
      removed.reduce<Record<string, number>>((acc, record) => {
        const key = getSourceName(record);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    )
      .sort((left, right) => right[1] - left[1])
      .map(([source, count]) => ({ source, count })),
    removedSamples: removed.slice(0, 80).map((record) => ({
      source: getSourceName(record),
      title: normalizeQuestion(record),
      url: getUrl(record),
    })),
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), 'utf-8');

  if (WRITE_CLEANED) {
    fs.mkdirSync(path.dirname(CLEANED_FILE), { recursive: true });
    fs.writeFileSync(CLEANED_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
  }

  console.log(JSON.stringify(report, null, 2));
  if (WRITE_CLEANED) {
    console.log(`cleaned_file=${CLEANED_FILE}`);
  }
}

main();

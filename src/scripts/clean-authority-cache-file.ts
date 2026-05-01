import fs from 'fs';
import path from 'path';
import {
  containsDeathRelatedTerms,
  isHighRiskOrClickbaitTitle,
  isLikelyEnglishNavigationShell,
  isOffTopicGovPolicyTitle,
} from '../services/authority-adapters/base.adapter';
import { shouldFilterAuthoritySourceUrl } from '../utils/authority-source-url';

interface CacheEntry {
  id?: string;
  source_id?: string;
  source_url?: string;
  url?: string;
  source_org?: string;
  source?: string;
  question?: string;
  answer?: string;
  [key: string]: unknown;
}

const CACHE_PATH = path.resolve(__dirname, '../../data/authority-knowledge-cache.json');

function rejectionReason(entry: CacheEntry): string | null {
  const sourceId = entry.source_id || '';
  const title = entry.question || '';

  const govReason = isOffTopicGovPolicyTitle(title, sourceId);
  if (govReason) {
    return govReason;
  }

  const sensitivityReason = isHighRiskOrClickbaitTitle(title);
  if (sensitivityReason) {
    return sensitivityReason;
  }

  if (containsDeathRelatedTerms(`${entry.answer || ''}`)) {
    return 'death_related_term_in_body';
  }

  if (isLikelyEnglishNavigationShell(`${entry.summary || ''} ${entry.answer || ''}`)) {
    return 'english_navigation_shell';
  }

  if (shouldFilterAuthoritySourceUrl({
    source_id: sourceId,
    source_org: entry.source_org,
    source_url: entry.source_url || entry.url,
    source: entry.source,
    title,
    question: title,
  })) {
    return 'navigation_or_index_url';
  }

  return null;
}

function main() {
  if (!fs.existsSync(CACHE_PATH)) {
    console.error('cache file missing:', CACHE_PATH);
    process.exit(1);
  }

  const raw = fs.readFileSync(CACHE_PATH, 'utf8');
  const entries: CacheEntry[] = JSON.parse(raw);

  const rejected: Array<{ reason: string; source_id: string; question: string; source_url?: string }> = [];
  const retained: CacheEntry[] = [];

  for (const entry of entries) {
    const reason = rejectionReason(entry);
    if (reason) {
      rejected.push({
        reason,
        source_id: entry.source_id || 'unknown',
        question: entry.question || '',
        source_url: entry.source_url || entry.url,
      });
    } else {
      retained.push(entry);
    }
  }

  if (rejected.length === 0) {
    console.log(JSON.stringify({ scanned: entries.length, rejected: 0 }, null, 2));
    return;
  }

  const backupPath = `${CACHE_PATH}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.writeFileSync(backupPath, raw);
  fs.writeFileSync(CACHE_PATH, `${JSON.stringify(retained, null, 2)}\n`);

  console.log(JSON.stringify({
    scanned: entries.length,
    rejected: rejected.length,
    retained: retained.length,
    backupPath,
    rejectedDocuments: rejected,
  }, null, 2));
}

main();

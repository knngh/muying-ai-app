import fs from 'fs';
import path from 'path';
import { getDatasetKnowledgeDropReason, type KnowledgeGuardRecord } from '../utils/knowledge-content-guard';

const INPUT_FILE = process.env.INPUT_FILE || path.join(process.cwd(), 'data', 'expanded-qa-data-5000.json');
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(process.cwd(), 'tmp', 'expanded-qa-data-5000.cleaned.json');
const REPORT_FILE = process.env.REPORT_FILE || path.join(process.cwd(), 'tmp', 'expanded-qa-data-5000.clean-report.json');
const WRITE_BACK = process.env.WRITE_BACK === 'true';

interface CleanReportItem {
  index: number;
  id?: string;
  reason: string;
  question?: string;
  category?: string;
}

function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  const raw = fs.readFileSync(INPUT_FILE, 'utf8');
  const records = JSON.parse(raw) as Array<KnowledgeGuardRecord & { id?: string }>;
  const kept: typeof records = [];
  const removed: CleanReportItem[] = [];
  const reasons: Record<string, number> = {};

  records.forEach((record, index) => {
    const reason = getDatasetKnowledgeDropReason(record);
    if (reason) {
      reasons[reason] = (reasons[reason] || 0) + 1;
      removed.push({
        index,
        id: record.id,
        reason,
        question: record.question,
        category: record.category,
      });
      return;
    }

    kept.push(record);
  });

  ensureParentDir(OUTPUT_FILE);
  ensureParentDir(REPORT_FILE);
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(kept, null, 2)}\n`);
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify({
    inputFile: INPUT_FILE,
    outputFile: OUTPUT_FILE,
    total: records.length,
    kept: kept.length,
    removed: removed.length,
    reasons,
    removedItems: removed,
  }, null, 2)}\n`);

  if (WRITE_BACK) {
    const backupFile = `${INPUT_FILE}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(INPUT_FILE, backupFile);
    fs.writeFileSync(INPUT_FILE, `${JSON.stringify(kept, null, 2)}\n`);
    console.log(`Wrote cleaned knowledge base to ${INPUT_FILE}`);
    console.log(`Backup saved to ${backupFile}`);
  } else {
    console.log(`Dry run only. Set WRITE_BACK=true to replace ${INPUT_FILE}`);
  }

  console.log(JSON.stringify({
    total: records.length,
    kept: kept.length,
    removed: removed.length,
    reasons,
    outputFile: OUTPUT_FILE,
    reportFile: REPORT_FILE,
  }, null, 2));
}

main();

import '../config/env';
import fs from 'fs';
import path from 'path';
import {
  repairAuthoritySourceLinks,
  type AuthoritySourceLinkRecord,
} from '../utils/authority-source-link-repair';

const INPUT_FILE = process.env.INPUT_FILE || path.join(process.cwd(), 'data', 'authority-knowledge-cache.json');
const REPORT_FILE = process.env.REPORT_FILE || path.join(process.cwd(), 'tmp', 'authority-source-link-repair-report.json');
const DRY_RUN = process.env.DRY_RUN !== 'false';

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`authority cache file missing: ${INPUT_FILE}`);
  }

  const raw = fs.readFileSync(INPUT_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`authority cache file must contain an array: ${INPUT_FILE}`);
  }

  const result = repairAuthoritySourceLinks(parsed as AuthoritySourceLinkRecord[]);
  const report = {
    inputFile: INPUT_FILE,
    dryRun: DRY_RUN,
    scanned: result.scanned,
    repaired: result.repaired,
    alreadyComplete: result.alreadyComplete,
    missingSourceUrl: result.missingSourceUrl,
    missingUrl: result.missingUrl,
    missingOriginalId: result.missingOriginalId,
    unrecoverable: result.unrecoverable,
    repairedEntries: result.repairedEntries,
  };

  writeJson(REPORT_FILE, report);

  let backupPath = '';
  if (!DRY_RUN && result.repaired > 0) {
    backupPath = `${INPUT_FILE}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.writeFileSync(backupPath, raw, 'utf-8');
    writeJson(INPUT_FILE, result.records);
  }

  console.log(JSON.stringify({
    ...report,
    reportFile: REPORT_FILE,
    backupPath: backupPath || undefined,
  }, null, 2));
}

main();

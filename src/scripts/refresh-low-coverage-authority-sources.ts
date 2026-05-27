import '../config/env';
import fs from 'fs';
import path from 'path';
import { diagnoseAuthorityUrlDiscovery, syncAuthoritySource } from '../services/authority-sync.service';
import { getAuthoritySourceConfig } from '../config/authority-sources';
import {
  buildAuthoritySourceDryRunSummaries,
  DEFAULT_AUTHORITY_SOURCE_MIN_DISCOVERY_CANDIDATES,
  evaluateAuthoritySourceDiscoveryPreflight,
  parseAuthoritySourceIdList,
  selectAuthoritySourcesForRefresh,
  type AuthoritySourceRefreshReport,
} from '../utils/authority-source-refresh';

const REPORT_FILE = process.env.REPORT_FILE || path.join(process.cwd(), 'tmp', 'knowledge-ops-report.json');
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(process.cwd(), 'tmp', 'knowledge-low-coverage-source-refresh.json');
const DRY_RUN = process.env.DRY_RUN !== 'false';
const AUTHORITY_SYNC_MODE = (process.env.AUTHORITY_SYNC_MODE || 'incremental') as 'full' | 'incremental';
const SOURCE_IDS = parseAuthoritySourceIdList(process.env.AUTHORITY_SOURCE_IDS || process.env.AUTHORITY_SOURCE_ID);
const LIMIT = process.env.AUTHORITY_SOURCE_LIMIT ? Number(process.env.AUTHORITY_SOURCE_LIMIT) : undefined;
const PROBE_DISCOVERY = /^true$/i.test(process.env.AUTHORITY_SOURCE_DRY_RUN_PROBE_DISCOVERY || '');
const PROBE_SAMPLE_LIMIT = process.env.AUTHORITY_SOURCE_DRY_RUN_SAMPLE_LIMIT
  ? Number(process.env.AUTHORITY_SOURCE_DRY_RUN_SAMPLE_LIMIT)
  : undefined;
const PREFLIGHT_DISCOVERY = process.env.AUTHORITY_SOURCE_PREFLIGHT_DISCOVERY !== 'false';

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const MIN_DISCOVERY_CANDIDATES = parsePositiveInteger(
  process.env.AUTHORITY_SOURCE_MIN_DISCOVERY_CANDIDATES,
  DEFAULT_AUTHORITY_SOURCE_MIN_DISCOVERY_CANDIDATES,
);

function readReport(filePath: string): AuthoritySourceRefreshReport {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Knowledge ops report not found: ${filePath}. Run npm run ops:knowledge:report first.`);
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AuthoritySourceRefreshReport;
}

async function main() {
  const report = readReport(REPORT_FILE);
  const selectedSources = selectAuthoritySourcesForRefresh(report, {
    sourceIds: SOURCE_IDS,
    limit: LIMIT,
  });
  const startedAt = new Date().toISOString();

  if (selectedSources.length === 0) {
    const payload = {
      startedAt,
      finishedAt: new Date().toISOString(),
      dryRun: DRY_RUN,
      mode: AUTHORITY_SYNC_MODE,
      reportFile: REPORT_FILE,
      selectedSources: [],
      summaries: [],
    };
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const summaries = [];
  if (DRY_RUN) {
    summaries.push(...await buildAuthoritySourceDryRunSummaries(selectedSources, {
      probeDiscovery: PROBE_DISCOVERY,
      sampleLimit: PROBE_SAMPLE_LIMIT,
      minimumDiscovered: MIN_DISCOVERY_CANDIDATES,
      diagnoseDiscovery: async (sourceId) => {
        const sourceConfig = getAuthoritySourceConfig(sourceId);
        if (!sourceConfig) {
          throw new Error(`Authority source not configured: ${sourceId}`);
        }
        const diagnosis = await diagnoseAuthorityUrlDiscovery(sourceConfig, AUTHORITY_SYNC_MODE, {
          sampleLimit: PROBE_SAMPLE_LIMIT,
        });
        return {
          discovered: diagnosis.discovered,
          entryDiagnostics: diagnosis.entryDiagnostics,
        };
      },
    }));
  } else if (PREFLIGHT_DISCOVERY) {
    for (const source of selectedSources) {
      const sourceId = source.sourceId!;
      const sourceConfig = getAuthoritySourceConfig(sourceId);
      if (!sourceConfig) {
        throw new Error(`Authority source not configured: ${sourceId}`);
      }

      const diagnosis = await diagnoseAuthorityUrlDiscovery(sourceConfig, AUTHORITY_SYNC_MODE, {
        sampleLimit: PROBE_SAMPLE_LIMIT,
      });
      const preflight = evaluateAuthoritySourceDiscoveryPreflight(sourceId, {
        discovered: diagnosis.discovered,
        entryDiagnostics: diagnosis.entryDiagnostics,
      }, PROBE_SAMPLE_LIMIT, {
        minimumDiscovered: MIN_DISCOVERY_CANDIDATES,
      });

      if (!preflight.ok) {
        summaries.push({
          sourceId,
          skipped: true,
          reason: 'preflight_failed',
          discoveryPreflight: preflight,
        });
        continue;
      }

      summaries.push({
        ...await syncAuthoritySource(sourceId, AUTHORITY_SYNC_MODE),
        discoveryPreflight: preflight,
      });
    }
  } else {
    for (const source of selectedSources) {
      summaries.push(await syncAuthoritySource(source.sourceId!, AUTHORITY_SYNC_MODE));
    }
  }

  const payload = {
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    mode: AUTHORITY_SYNC_MODE,
    preflightDiscovery: !DRY_RUN && PREFLIGHT_DISCOVERY,
    reportFile: REPORT_FILE,
    selectedSources,
    summaries,
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(JSON.stringify(payload, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Authority Source Refresh] failed:', error);
    process.exit(1);
  });

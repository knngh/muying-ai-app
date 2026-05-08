export type AuthoritySourceRefreshStatus = 'missing' | 'low' | 'healthy';

export interface AuthoritySourceCoverageEntry {
  sourceId?: string;
  count?: number;
  minimumPublishedRecords?: number;
  status?: string;
}

export interface AuthoritySourceRefreshReport {
  sourceCoverage?: {
    watchedSources?: AuthoritySourceCoverageEntry[];
  };
}

export interface SelectAuthoritySourcesForRefreshOptions {
  statuses?: AuthoritySourceRefreshStatus[];
  sourceIds?: string[];
  limit?: number;
}

export interface AuthoritySourceDryRunSummary {
  sourceId?: string;
  skipped: true;
  reason: 'dry_run';
  discoveryProbe?: {
    ok: boolean;
    discovered: number;
    sampleUrls: string[];
    entryDiagnostics?: AuthoritySourceDiscoveryEntryDiagnostic[];
    error?: string;
  };
}

export interface AuthoritySourceDiscoveryEntryDiagnostic {
  entryUrl: string;
  ok: boolean;
  status?: number | null;
  contentType?: string | null;
  locCount?: number;
  nestedSitemapCount?: number;
  matchedCandidateCount?: number;
  paginationCandidateCount?: number;
  sampleMatchedUrls?: string[];
  error?: string;
}

export interface AuthoritySourceDiscoveryDiagnosis {
  discovered: Array<{ url?: string }>;
  entryDiagnostics: AuthoritySourceDiscoveryEntryDiagnostic[];
}

export interface BuildAuthoritySourceDryRunSummariesOptions {
  probeDiscovery?: boolean;
  sampleLimit?: number;
  discover?: (sourceId: string) => Promise<Array<{ url?: string }>>;
  diagnoseDiscovery?: (sourceId: string) => Promise<AuthoritySourceDiscoveryDiagnosis>;
}

const DEFAULT_REFRESH_STATUSES: AuthoritySourceRefreshStatus[] = ['missing', 'low'];

function normalizeSourceId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRefreshStatus(value: unknown): AuthoritySourceRefreshStatus | null {
  return value === 'missing' || value === 'low' || value === 'healthy' ? value : null;
}

export function parseAuthoritySourceIdList(value?: string): string[] {
  if (!value) {
    return [];
  }

  return Array.from(new Set(
    value
      .split(',')
      .map((item) => normalizeSourceId(item))
      .filter(Boolean),
  ));
}

export function selectAuthoritySourcesForRefresh(
  report: AuthoritySourceRefreshReport,
  options: SelectAuthoritySourcesForRefreshOptions = {},
): AuthoritySourceCoverageEntry[] {
  const allowedStatuses = new Set(options.statuses || DEFAULT_REFRESH_STATUSES);
  const explicitSourceIds = new Set((options.sourceIds || []).map((id) => normalizeSourceId(id)).filter(Boolean));
  const limit = Number.isFinite(options.limit) && Number(options.limit) > 0 ? Math.floor(Number(options.limit)) : Infinity;
  const selected: AuthoritySourceCoverageEntry[] = [];
  const seen = new Set<string>();

  for (const source of report.sourceCoverage?.watchedSources || []) {
    const sourceId = normalizeSourceId(source.sourceId);
    const status = normalizeRefreshStatus(source.status);
    if (!sourceId || !status || !allowedStatuses.has(status) || seen.has(sourceId)) {
      continue;
    }

    if (explicitSourceIds.size > 0 && !explicitSourceIds.has(sourceId)) {
      continue;
    }

    selected.push({
      sourceId,
      count: Number(source.count || 0),
      minimumPublishedRecords: Number(source.minimumPublishedRecords || 0),
      status,
    });
    seen.add(sourceId);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'unknown error');
}

export async function buildAuthoritySourceDryRunSummaries(
  selectedSources: AuthoritySourceCoverageEntry[],
  options: BuildAuthoritySourceDryRunSummariesOptions = {},
): Promise<AuthoritySourceDryRunSummary[]> {
  const sampleLimit = Number.isFinite(options.sampleLimit) && Number(options.sampleLimit) >= 0
    ? Math.floor(Number(options.sampleLimit))
    : 5;

  const summaries: AuthoritySourceDryRunSummary[] = [];
  for (const source of selectedSources) {
    const summary: AuthoritySourceDryRunSummary = {
      sourceId: source.sourceId,
      skipped: true,
      reason: 'dry_run',
    };

    if (options.probeDiscovery && source.sourceId && (options.diagnoseDiscovery || options.discover)) {
      try {
        const diagnosis = options.diagnoseDiscovery
          ? await options.diagnoseDiscovery(source.sourceId)
          : null;
        const discovered = diagnosis?.discovered || await options.discover!(source.sourceId);
        summary.discoveryProbe = {
          ok: true,
          discovered: discovered.length,
          sampleUrls: discovered
            .map((item) => item.url)
            .filter((url): url is string => typeof url === 'string' && url.length > 0)
            .slice(0, sampleLimit),
        };
        if (diagnosis?.entryDiagnostics) {
          summary.discoveryProbe.entryDiagnostics = diagnosis.entryDiagnostics;
        }
      } catch (error) {
        summary.discoveryProbe = {
          ok: false,
          discovered: 0,
          sampleUrls: [],
          error: getErrorMessage(error),
        };
      }
    }

    summaries.push(summary);
  }

  return summaries;
}

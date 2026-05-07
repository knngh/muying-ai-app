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

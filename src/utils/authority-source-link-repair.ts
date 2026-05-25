export interface AuthoritySourceLinkRecord {
  id?: string;
  source_id?: string;
  question?: string;
  source_url?: string;
  url?: string;
  original_id?: string;
  references?: Array<{
    url?: unknown;
    source_url?: unknown;
    link?: unknown;
  }>;
  metadata?: {
    sourceUrl?: unknown;
    source_url?: unknown;
    url?: unknown;
    originalId?: unknown;
    original_id?: unknown;
  };
  [key: string]: unknown;
}

export interface AuthoritySourceLinkRepairEntry {
  id?: string;
  sourceId?: string;
  question?: string;
  sourceUrl: string;
  repairedFields: string[];
}

export interface AuthoritySourceLinkRepairResult {
  records: AuthoritySourceLinkRecord[];
  scanned: number;
  repaired: number;
  alreadyComplete: number;
  missingSourceUrl: number;
  missingUrl: number;
  missingOriginalId: number;
  unrecoverable: Array<{
    id?: string;
    sourceId?: string;
    question?: string;
  }>;
  repairedEntries: AuthoritySourceLinkRepairEntry[];
}

function normalizeHttpUrl(input: unknown): string {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) {
    return '';
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function firstHttpUrl(...values: unknown[]): string {
  for (const value of values) {
    const url = normalizeHttpUrl(value);
    if (url) {
      return url;
    }
  }

  return '';
}

export function getAuthoritySourceLinkCandidate(record: AuthoritySourceLinkRecord): string {
  const referenceUrls = Array.isArray(record.references)
    ? record.references.flatMap((reference) => [reference?.source_url, reference?.url, reference?.link])
    : [];

  return firstHttpUrl(
    record.source_url,
    record.url,
    record.original_id,
    record.metadata?.sourceUrl,
    record.metadata?.source_url,
    record.metadata?.url,
    record.metadata?.originalId,
    record.metadata?.original_id,
    ...referenceUrls,
  );
}

function isMissingOrInvalidUrl(value: unknown): boolean {
  return !normalizeHttpUrl(value);
}

export function repairAuthoritySourceLinks(
  records: AuthoritySourceLinkRecord[],
): AuthoritySourceLinkRepairResult {
  const repairedRecords: AuthoritySourceLinkRecord[] = [];
  const repairedEntries: AuthoritySourceLinkRepairEntry[] = [];
  const unrecoverable: AuthoritySourceLinkRepairResult['unrecoverable'] = [];
  let alreadyComplete = 0;
  let missingSourceUrl = 0;
  let missingUrl = 0;
  let missingOriginalId = 0;

  for (const record of records) {
    const candidate = getAuthoritySourceLinkCandidate(record);
    const repairedFields: string[] = [];
    const nextRecord = { ...record };
    const needsSourceUrl = isMissingOrInvalidUrl(nextRecord.source_url);
    const needsUrl = isMissingOrInvalidUrl(nextRecord.url);
    const needsOriginalId = isMissingOrInvalidUrl(nextRecord.original_id);

    if (needsSourceUrl) missingSourceUrl += 1;
    if (needsUrl) missingUrl += 1;
    if (needsOriginalId) missingOriginalId += 1;

    if (!needsSourceUrl && !needsUrl && !needsOriginalId) {
      alreadyComplete += 1;
      repairedRecords.push(nextRecord);
      continue;
    }

    if (!candidate) {
      unrecoverable.push({
        id: record.id,
        sourceId: record.source_id,
        question: record.question,
      });
      repairedRecords.push(nextRecord);
      continue;
    }

    if (needsSourceUrl) {
      nextRecord.source_url = candidate;
      repairedFields.push('source_url');
    }
    if (needsUrl) {
      nextRecord.url = candidate;
      repairedFields.push('url');
    }
    if (needsOriginalId) {
      nextRecord.original_id = candidate;
      repairedFields.push('original_id');
    }

    if (repairedFields.length > 0) {
      repairedEntries.push({
        id: record.id,
        sourceId: record.source_id,
        question: record.question,
        sourceUrl: candidate,
        repairedFields,
      });
    }

    repairedRecords.push(nextRecord);
  }

  return {
    records: repairedRecords,
    scanned: records.length,
    repaired: repairedEntries.length,
    alreadyComplete,
    missingSourceUrl,
    missingUrl,
    missingOriginalId,
    unrecoverable,
    repairedEntries,
  };
}

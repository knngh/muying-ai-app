type AuthorityVectorRecord = {
  title?: string;
  question?: string;
  topic?: string;
  category?: string;
  sourceOrg?: string;
  source?: string;
  sourceClass?: string;
  authoritative?: boolean;
};

const NOISY_VECTOR_TITLE_PATTERNS = [
  /孕期全指导：怀孕第\d+周/u,
  /政策解读|通知解读|五问五答/u,
  /Clinical Practice Update|Practice Update|Committee Opinion/i,
  /Permanent Contraception|sterilisation|sterilization/i,
  /^Appendix\s+[IVXLC]+:/i,
  /^How it is used\b/i,
  /Coveo indexes/i,
];

const NOISY_VECTOR_SOURCE_PATTERNS = [
  /有来医生/u,
  /家庭医生在线/u,
  /丁香医生/u,
  /春雨医生/u,
];

function getVectorTitle(record: AuthorityVectorRecord): string {
  return `${record.title || ''} ${record.question || ''}`.trim();
}

function getVectorTopic(record: AuthorityVectorRecord): string {
  return `${record.topic || ''} ${record.category || ''}`.trim();
}

function getVectorSource(record: AuthorityVectorRecord): string {
  return `${record.sourceOrg || ''} ${record.source || ''}`.trim();
}

function hasNoisyVectorSource(record: AuthorityVectorRecord): boolean {
  const source = getVectorSource(record);
  return NOISY_VECTOR_SOURCE_PATTERNS.some((pattern) => pattern.test(source));
}

export function isWeakAuthorityVectorDocument(record: AuthorityVectorRecord): boolean {
  const title = getVectorTitle(record);
  const topic = getVectorTopic(record);

  if (!title) {
    return true;
  }

  if (NOISY_VECTOR_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return true;
  }

  if (/^policy$/i.test(topic)) {
    return true;
  }

  return false;
}

export function shouldPublishAuthorityVectorDocument(record: AuthorityVectorRecord): boolean {
  if (isWeakAuthorityVectorDocument(record)) {
    return false;
  }

  if (hasNoisyVectorSource(record)) {
    return false;
  }

  if (record.authoritative === false) {
    return false;
  }

  if (record.sourceClass !== 'official') {
    return false;
  }

  return true;
}

export function shouldUseAuthorityVectorSupplement(record: AuthorityVectorRecord): boolean {
  if (isWeakAuthorityVectorDocument(record)) {
    return false;
  }

  if (hasNoisyVectorSource(record)) {
    return false;
  }

  if (record.authoritative === false) {
    return false;
  }

  if (record.sourceClass && record.sourceClass !== 'official') {
    return false;
  }

  return true;
}

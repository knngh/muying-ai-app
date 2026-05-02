import { getAuthorityKnowledgeDropReason } from './knowledge-content-guard';
import {
  getMedicalPlatformQualityDropReason,
  isMedicalPlatformRecord,
} from './medical-platform-quality';

type AuthorityVectorRecord = {
  sourceId?: string;
  title?: string;
  question?: string;
  summary?: string;
  answer?: string;
  topic?: string;
  category?: string;
  sourceOrg?: string;
  source?: string;
  sourceClass?: string;
  sourceUrl?: string;
  updatedAt?: string;
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

function getVectorTitle(record: AuthorityVectorRecord): string {
  return `${record.title || ''} ${record.question || ''}`.trim();
}

function getVectorTopic(record: AuthorityVectorRecord): string {
  return `${record.topic || ''} ${record.category || ''}`.trim();
}

export function isWeakAuthorityVectorDocument(record: AuthorityVectorRecord): boolean {
  const title = getVectorTitle(record);
  const topic = getVectorTopic(record);

  if (!title) {
    return true;
  }

  if (getAuthorityKnowledgeDropReason({
    title,
    question: record.question,
    summary: record.summary,
    answer: record.answer,
    category: record.category,
    source: record.source,
    source_org: record.sourceOrg,
    source_class: record.sourceClass,
  })) {
    return true;
  }

  if (NOISY_VECTOR_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return true;
  }

  if (getMedicalPlatformQualityDropReason({
    title,
    summary: record.summary,
    answer: record.answer,
    sourceId: record.sourceId,
    sourceOrg: record.sourceOrg,
    source: record.source,
    sourceClass: record.sourceClass,
    sourceUrl: record.sourceUrl,
    updatedAt: record.updatedAt,
  })) {
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

  if (record.authoritative === false) {
    return false;
  }

  return record.sourceClass === 'official' || isMedicalPlatformRecord(record);
}

export function shouldUseAuthorityVectorSupplement(record: AuthorityVectorRecord): boolean {
  if (isWeakAuthorityVectorDocument(record)) {
    return false;
  }

  if (record.authoritative === false) {
    return false;
  }

  if (record.sourceClass && record.sourceClass !== 'official' && !isMedicalPlatformRecord(record)) {
    return false;
  }

  return true;
}

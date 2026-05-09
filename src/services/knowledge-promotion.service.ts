import fs from 'fs';
import path from 'path';
import {
  isKnowledgePromotionStage,
  normalizeKnowledgePromotionTargetStage,
  type KnowledgePromotionStage,
} from '../utils/knowledge-promotion-stage';

export type KnowledgeRecommendedQuestionStage = KnowledgePromotionStage;

export interface KnowledgeRecommendedQuestion {
  id?: string;
  question: string;
  searchKeyword: string;
  category?: string;
  topic?: string;
  targetStage: string[];
  riskLevel: 'green' | 'yellow';
  suggestedUse: 'general_education' | 'care_boundary';
  boundaryNote?: string;
  sourceOrg?: string;
  sourceTitle?: string;
}

export interface KnowledgeRecommendedQuestionsResponse {
  stage: KnowledgeRecommendedQuestionStage | null;
  source: 'knowledge_ops_report' | 'fallback';
  total: number;
  questions: KnowledgeRecommendedQuestion[];
}

export interface KnowledgePromotionQuestionCandidate {
  id?: string;
  question?: string;
  category?: string;
  topic?: string;
  targetStage?: string[];
  riskLevel?: string;
  suggestedUse?: string;
  boundaryNote?: string;
  authorityReference?: {
    title?: string;
    sourceOrg?: string;
  };
}

export interface KnowledgePromotionReport {
  promotion?: {
    safeQuestionCandidates?: {
      total?: number;
      candidates?: KnowledgePromotionQuestionCandidate[];
    };
  };
}

export interface KnowledgeRecommendedQuestionOptions {
  stage?: KnowledgeRecommendedQuestionStage | null;
  limit?: number;
  reportPath?: string;
  report?: KnowledgePromotionReport | null;
}

const DEFAULT_REPORT_PATH = path.join(process.cwd(), 'tmp', 'knowledge-ops-report.json');
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;
const CARE_BOUNDARY_NOTE = '仅用于科普与就医准备，不作为诊断或治疗建议。';

const FALLBACK_QUESTIONS: KnowledgeRecommendedQuestion[] = [
  {
    question: '孕早期产检要注意什么？',
    searchKeyword: '孕早期 产检 注意事项',
    category: 'pregnancy-early',
    topic: 'pregnancy',
    targetStage: ['first-trimester'],
    riskLevel: 'green',
    suggestedUse: 'general_education',
    sourceOrg: '权威知识库',
  },
  {
    question: '孕中期胎动怎么数？',
    searchKeyword: '孕中期 胎动 怎么数',
    category: 'pregnancy-mid',
    topic: 'pregnancy',
    targetStage: ['second-trimester'],
    riskLevel: 'green',
    suggestedUse: 'general_education',
    sourceOrg: '权威知识库',
  },
  {
    question: '孕晚期入院信号要注意什么？',
    searchKeyword: '孕晚期 入院信号 注意事项',
    category: 'pregnancy-late',
    topic: 'pregnancy',
    targetStage: ['third-trimester'],
    riskLevel: 'green',
    suggestedUse: 'general_education',
    sourceOrg: '权威知识库',
  },
  {
    question: '宝宝睡眠作息要注意什么？',
    searchKeyword: '宝宝 睡眠 作息 注意事项',
    category: 'parenting-0-1',
    topic: 'newborn',
    targetStage: ['newborn', '0-6-months', '6-12-months'],
    riskLevel: 'green',
    suggestedUse: 'general_education',
    sourceOrg: '权威知识库',
  },
  {
    question: '6 个月宝宝添加辅食要注意什么？',
    searchKeyword: '6个月 宝宝 添加辅食 注意事项',
    category: 'parenting-0-1',
    topic: 'feeding',
    targetStage: ['6-12-months'],
    riskLevel: 'green',
    suggestedUse: 'general_education',
    sourceOrg: '权威知识库',
  },
  {
    question: '宝宝发热什么时候需要就医？',
    searchKeyword: '宝宝 发热 什么时候 就医',
    category: 'common-symptoms',
    topic: 'common-symptoms',
    targetStage: ['newborn', '0-6-months', '6-12-months', '1-3-years'],
    riskLevel: 'yellow',
    suggestedUse: 'care_boundary',
    boundaryNote: CARE_BOUNDARY_NOTE,
    sourceOrg: '权威知识库',
  },
];

function normalizeLimit(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(value), MAX_LIMIT);
}

function readReport(filePath: string): KnowledgePromotionReport | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as KnowledgePromotionReport;
  } catch {
    return null;
  }
}

function normalizeCandidate(candidate: KnowledgePromotionQuestionCandidate): KnowledgeRecommendedQuestion | null {
  const question = typeof candidate.question === 'string' ? candidate.question.trim() : '';
  const riskLevel = candidate.riskLevel === 'green' || candidate.riskLevel === 'yellow' ? candidate.riskLevel : null;
  const suggestedUse = candidate.suggestedUse === 'general_education' || candidate.suggestedUse === 'care_boundary'
    ? candidate.suggestedUse
    : null;

  if (!question || !riskLevel || !suggestedUse) {
    return null;
  }

  const normalizedTargetStage = normalizeCandidateTargetStage(candidate, question);

  return {
    id: candidate.id,
    question,
    searchKeyword: question.replace(/[？?]\s*$/u, ''),
    category: candidate.category,
    topic: candidate.topic,
    targetStage: normalizedTargetStage,
    riskLevel,
    suggestedUse,
    boundaryNote: suggestedUse === 'care_boundary' ? candidate.boundaryNote || CARE_BOUNDARY_NOTE : undefined,
    sourceOrg: candidate.authorityReference?.sourceOrg,
    sourceTitle: candidate.authorityReference?.title,
  };
}

function normalizeCandidateTargetStage(
  candidate: KnowledgePromotionQuestionCandidate,
  question: string,
): KnowledgeRecommendedQuestionStage[] {
  return normalizeKnowledgePromotionTargetStage(candidate, question)
    .filter((item): item is KnowledgeRecommendedQuestionStage => isKnowledgePromotionStage(item));
}

function stageMatches(question: KnowledgeRecommendedQuestion, stage: KnowledgeRecommendedQuestionStage | null): boolean {
  if (!stage) {
    return true;
  }

  if (question.targetStage.includes(stage)) {
    return true;
  }

  if (stage === 'postpartum') {
    return question.targetStage.includes('newborn') || question.category === 'postpartum';
  }

  if (stage === 'newborn') {
    return question.targetStage.includes('0-6-months') || question.topic === 'newborn';
  }

  return false;
}

function buildQuestionsFromReport(report: KnowledgePromotionReport | null | undefined): KnowledgeRecommendedQuestion[] {
  return (report?.promotion?.safeQuestionCandidates?.candidates || [])
    .map(normalizeCandidate)
    .filter((item): item is KnowledgeRecommendedQuestion => Boolean(item));
}

function dedupeQuestions(questions: KnowledgeRecommendedQuestion[]): KnowledgeRecommendedQuestion[] {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = question.question;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildKnowledgeRecommendedQuestions(
  options: KnowledgeRecommendedQuestionOptions = {},
): KnowledgeRecommendedQuestionsResponse {
  const stage = options.stage || null;
  const limit = normalizeLimit(options.limit);
  const report = options.report === undefined
    ? readReport(options.reportPath || DEFAULT_REPORT_PATH)
    : options.report;
  const reportQuestions = dedupeQuestions(buildQuestionsFromReport(report));
  const source = reportQuestions.length > 0 ? 'knowledge_ops_report' : 'fallback';
  const sourceQuestions = reportQuestions.length > 0 ? reportQuestions : FALLBACK_QUESTIONS;
  const matched = sourceQuestions.filter((question) => stageMatches(question, stage));
  const selected = (stage ? matched : sourceQuestions).slice(0, limit);

  return {
    stage,
    source,
    total: selected.length,
    questions: selected,
  };
}

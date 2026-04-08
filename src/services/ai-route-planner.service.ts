import type { SourceReference } from './knowledge.service';
import type {
  TrustedRiskLevel,
  TrustedSourceReliability,
  TrustedTriageCategory,
} from './trusted-ai.service';
import type { AITaskModelRole } from './ai-gateway.service';

export type RetrievalTier = 'strong' | 'medium' | 'weak';
export type QuestionComplexity = 'simple' | 'medium' | 'high';
export type TrafficTier = 'guest' | 'default';
export type ExecutionStep = 'system' | AITaskModelRole;

export interface RoutePlan {
  riskLevel: TrustedRiskLevel;
  triageCategory: TrustedTriageCategory;
  retrievalTier: RetrievalTier;
  complexity: QuestionComplexity;
  trafficTier: TrafficTier;
  executionPlan: ExecutionStep[];
  allowFreeGeneration: boolean;
  reason: string;
}

function countMatchedPatterns(text: string, patterns: RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

const HIGH_COMPLEXITY_PATTERNS = [
  /同时|并且|而且|另外|还伴有/u,
  /多久|几天|多长时间|反复/u,
  /检查单|化验单|报告|B超|彩超|CT|核磁|指标/u,
  /药量|剂量|退烧药|抗生素|处方药/u,
  /孕周|月龄|产后|出生/u,
  /是不是|严不严重|需不需要去医院/u,
];

const MEDIUM_COMPLEXITY_PATTERNS = [
  /发烧|发热|咳嗽|腹泻|呕吐|黄疸|湿疹|出血|见红|腹痛/u,
  /怎么办|怎么处理|如何护理|要注意什么/u,
];

export function inferQuestionComplexity(question: string): QuestionComplexity {
  const normalized = question.replace(/\s+/g, ' ').trim();
  const separators = normalized.split(/[，,。；;！？!?]/u).filter(Boolean).length;
  const highMatches = countMatchedPatterns(normalized, HIGH_COMPLEXITY_PATTERNS);
  const mediumMatches = countMatchedPatterns(normalized, MEDIUM_COMPLEXITY_PATTERNS);

  if (highMatches >= 2 || separators >= 4 || normalized.length >= 80) {
    return 'high';
  }

  if (highMatches >= 1 || mediumMatches >= 2 || normalized.length >= 32) {
    return 'medium';
  }

  return 'simple';
}

export function inferRetrievalTier(
  sources: SourceReference[],
  sourceReliability: TrustedSourceReliability,
): RetrievalTier {
  const topScore = sources[0]?.relevance || 0;
  const sourceCount = sources.length;

  if (
    topScore >= 0.78
    && sourceCount >= 2
    && (sourceReliability === 'authoritative' || sourceReliability === 'mixed')
  ) {
    return 'strong';
  }

  if (topScore >= 0.58 && sourceCount >= 1) {
    return sourceReliability === 'dataset_only' ? 'weak' : 'medium';
  }

  return 'weak';
}

export function planTrustedAIRoute(params: {
  question: string;
  userId?: string;
  riskLevel: TrustedRiskLevel;
  triageCategory: TrustedTriageCategory;
  sources: SourceReference[];
  sourceReliability: TrustedSourceReliability;
}): RoutePlan {
  const complexity = inferQuestionComplexity(params.question);
  const retrievalTier = inferRetrievalTier(params.sources, params.sourceReliability);
  const trafficTier: TrafficTier = params.userId ? 'default' : 'guest';

  if (params.triageCategory === 'emergency') {
    return {
      riskLevel: params.riskLevel,
      triageCategory: params.triageCategory,
      retrievalTier,
      complexity,
      trafficTier,
      executionPlan: ['system'],
      allowFreeGeneration: false,
      reason: 'red risk must stay on system template',
    };
  }

  if (params.triageCategory === 'out_of_scope') {
    return {
      riskLevel: params.riskLevel,
      triageCategory: params.triageCategory,
      retrievalTier,
      complexity,
      trafficTier,
      executionPlan: ['system'],
      allowFreeGeneration: false,
      reason: 'out of scope stays on system boundary response',
    };
  }

  if (params.triageCategory === 'caution') {
    if (retrievalTier === 'strong' && complexity === 'high') {
      return {
        riskLevel: params.riskLevel,
        triageCategory: params.triageCategory,
        retrievalTier,
        complexity,
        trafficTier,
        executionPlan: ['kimi_reason', 'minimax_render'],
        allowFreeGeneration: true,
        reason: 'yellow strong complex uses Kimi reasoning then MiniMax render',
      };
    }

    if (retrievalTier !== 'weak' && params.sourceReliability !== 'dataset_only') {
      return {
        riskLevel: params.riskLevel,
        triageCategory: params.triageCategory,
        retrievalTier,
        complexity,
        trafficTier,
        executionPlan: ['kimi_reason', 'minimax_render'],
        allowFreeGeneration: true,
        reason: 'yellow medium uses Kimi reasoning then MiniMax rendering',
      };
    }

    return {
      riskLevel: params.riskLevel,
      triageCategory: params.triageCategory,
      retrievalTier,
      complexity,
      trafficTier,
      executionPlan: ['glm_classify'],
      allowFreeGeneration: false,
      reason: 'yellow weak or dataset only must clarify/degrade instead of free answer',
    };
  }

  if (trafficTier === 'guest' && complexity === 'simple' && retrievalTier !== 'weak') {
    return {
      riskLevel: params.riskLevel,
      triageCategory: params.triageCategory,
      retrievalTier,
      complexity,
      trafficTier,
      executionPlan: ['glm_classify'],
      allowFreeGeneration: false,
      reason: 'guest simple traffic uses low-cost classification/fallback path',
    };
  }

  if (retrievalTier === 'strong' && complexity === 'simple') {
    return {
      riskLevel: params.riskLevel,
      triageCategory: params.triageCategory,
      retrievalTier,
      complexity,
      trafficTier,
      executionPlan: ['minimax_render'],
      allowFreeGeneration: true,
      reason: 'green strong simple can render directly with MiniMax',
    };
  }

  if (retrievalTier !== 'weak') {
    return {
      riskLevel: params.riskLevel,
      triageCategory: params.triageCategory,
      retrievalTier,
      complexity,
      trafficTier,
      executionPlan: ['kimi_reason', 'minimax_render'],
      allowFreeGeneration: true,
      reason: 'green medium or complex questions use Kimi reasoning then MiniMax render',
    };
  }

  return {
    riskLevel: params.riskLevel,
    triageCategory: params.triageCategory,
    retrievalTier,
    complexity,
    trafficTier,
    executionPlan: ['glm_classify'],
    allowFreeGeneration: false,
    reason: 'weak retrieval degrades to clarification/fallback',
  };
}

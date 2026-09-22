import { NAME_LIBRARY, NAME_LIBRARY_VERSION } from '../data/name-library';
import { NAME_EVALUATION_DISCLOSURE, NAME_MATCH_LABELS, type NameComparisonInput, type NameEvaluationResponse, type NameEvaluationCandidateResult, type NameEvaluationDimension, type NameMatchLevel } from '../data/name-evaluation';

export function withNameMatchDimensions(candidate: NameEvaluationCandidateResult, dimensions: NameEvaluationDimension[]): NameEvaluationCandidateResult {
  const matchLevel = dimensions.length && dimensions.every(dimension => dimension.level !== null)
    ? Math.round(dimensions.reduce((sum, dimension) => sum + dimension.level!, 0) / dimensions.length) as NameMatchLevel
    : null;
  return {
    ...candidate, dimensions, matchLevel,
    explanation: dimensions.map(dimension => dimension.level === null
      ? `「${dimension.preference}」暂不评分`
      : `「${dimension.preference}」${NAME_MATCH_LABELS[dimension.level]}`).join('；') + '。判断依据为上方库内释义。',
  };
}

/** Shared with the mini-program. Only library facts; no synthetic fallback scores. */
export function buildNameComparison(input: NameComparisonInput): NameEvaluationResponse {
  return {
    source: 'rules',
    libraryVersion: NAME_LIBRARY_VERSION,
    disclaimer: NAME_EVALUATION_DISCLOSURE,
    candidates: input.candidateIds.map(id => {
      const item = NAME_LIBRARY.find(candidate => candidate.id === id);
      if (!item) throw new Error('候选名不在当前名字库中，请重新选择');
      return {
        id, fullName: `${input.surname}${item.givenName}`, pinyin: item.pinyin,
        givenNameLength: Array.from(item.givenName).length,
        meaning: item.meaning, source: item.source, sourceQuote: item.sourceQuote,
        matchLevel: null,
        dimensions: input.preferences.map(preference => ({ preference, level: null })),
        explanation: '已整理库内资料，尚无可靠的 AI 匹配评分。',
      };
    }),
  };
}

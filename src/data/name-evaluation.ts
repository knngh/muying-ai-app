/** A subjective preference comparison, never a name-quality or fortune score. */
export const NAME_EVALUATION_PREFERENCES = ['清雅', '明朗', '稳重', '温柔', '简洁', '书卷感'] as const;
export type NameEvaluationPreference = typeof NAME_EVALUATION_PREFERENCES[number];
export type NameMatchLevel = 1 | 2 | 3 | 4 | 5;

export interface NameComparisonInput {
  surname: string;
  candidateIds: string[];
  preferences: NameEvaluationPreference[];
}

export interface NameEvaluationRequest extends NameComparisonInput {
  consent: true;
}

export interface NameEvaluationDimension {
  preference: NameEvaluationPreference;
  level: NameMatchLevel | null;
}

export interface NameEvaluationCandidateResult {
  id: string;
  fullName: string;
  pinyin: string;
  givenNameLength: number;
  meaning: string;
  source: string;
  sourceQuote?: string;
  matchLevel: NameMatchLevel | null;
  dimensions: NameEvaluationDimension[];
  explanation: string;
}

export interface NameEvaluationResponse {
  source: 'ai' | 'rules';
  libraryVersion: string;
  candidates: NameEvaluationCandidateResult[];
  disclaimer: string;
}

export const NAME_EVALUATION_DISCLOSURE = 'AI 匹配度仅表示与本次风格偏好的接近程度，不代表名字优劣。名字资料待人工复核；请与家人核对姓氏连读、方言谐音和避讳。';
export const NAME_MATCH_LABELS: Record<NameMatchLevel, string> = {
  1: '较少体现', 2: '略有体现', 3: '部分贴近', 4: '较为贴近', 5: '很贴近',
};

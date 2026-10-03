import { NAME_EVALUATION_PREFERENCES, type NameComparisonInput, type NameEvaluationResponse, type NameMatchLevel } from '../types/name-library'
import { buildNameComparison, withNameMatchDimensions } from '../../src/services/name-evaluation-rules'
import { NAME_LIBRARY_VERSION } from '../../src/data/name-library'

export const NAME_EVALUATIONS_KEY = 'beihu.nameEvaluations.v1'
export const NAME_COMPARISON_DRAFT_KEY = 'beihu.nameComparisonDraft.v1'
export const NAME_PREFERENCE_DRAFT_KEY = 'beihu.namePreferences.v1'
export const MAX_NAME_EVALUATIONS = 10
export interface SavedNameEvaluation {
  id: string
  createdAt: string
  input: NameComparisonInput
  result: NameEvaluationResponse
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

// Rebuild names, facts, arithmetic and wording from the current library. Never trust stored prose.
export function readNameEvaluations(value: unknown): SavedNameEvaluation[] {
  if (!Array.isArray(value)) return []
  const entries: SavedNameEvaluation[] = []
  for (const entry of value.slice(0, MAX_NAME_EVALUATIONS)) {
    if (!isObject(entry) || typeof entry.id !== 'string' || entry.id.length > 100
      || typeof entry.createdAt !== 'string' || !Number.isFinite(Date.parse(entry.createdAt))
      || !isObject(entry.input) || !isObject(entry.result)) continue
    const input = entry.input
    if (typeof input.surname !== 'string' || !/^[\p{Script=Han}]{0,4}$/u.test(input.surname)
      || !Array.isArray(input.candidateIds) || !input.candidateIds.length || input.candidateIds.length > 5
      || input.candidateIds.some(id => typeof id !== 'string') || new Set(input.candidateIds).size !== input.candidateIds.length
      || !Array.isArray(input.preferences) || !input.preferences.length || input.preferences.length > 3
      || input.preferences.some(preference => !NAME_EVALUATION_PREFERENCES.includes(preference))
      || new Set(input.preferences).size !== input.preferences.length
      || !['ai', 'rules'].includes(String(entry.result.source))
      || entry.result.libraryVersion !== NAME_LIBRARY_VERSION || !Array.isArray(entry.result.candidates)) continue
    try {
      const normalized = input as unknown as NameComparisonInput
      const base = buildNameComparison(normalized)
      const stored = entry.result.candidates
      const source = entry.result.source
      if (stored.length !== base.candidates.length) continue
      base.candidates = base.candidates.map((candidate, index) => {
        const previous = stored[index]
        if (!isObject(previous) || previous.id !== candidate.id || !Array.isArray(previous.dimensions)
          || previous.dimensions.length !== normalized.preferences.length) throw new Error('Invalid saved comparison')
        const dimensions = previous.dimensions.map((dimension, dimensionIndex) => {
          if (!isObject(dimension) || dimension.preference !== normalized.preferences[dimensionIndex]
            || (dimension.level !== null && !(typeof dimension.level === 'number' && Number.isInteger(dimension.level) && dimension.level >= 1 && dimension.level <= 5))) {
            throw new Error('Invalid saved dimension')
          }
          return { preference: normalized.preferences[dimensionIndex], level: source === 'rules' ? null : dimension.level as NameMatchLevel | null }
        })
        return withNameMatchDimensions(candidate, dimensions)
      })
      base.source = base.candidates.some(candidate => candidate.dimensions.some(dimension => dimension.level !== null)) ? 'ai' : 'rules'
      entries.push({ id: entry.id, createdAt: entry.createdAt, input: normalized, result: base })
    } catch { /* Unknown library IDs and corrupt records are ignored. */ }
  }
  return entries
}

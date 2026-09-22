import { readNameEvaluations } from '../shared/utils/name-evaluation';
import { buildNameComparison } from '../src/services/name-evaluation-rules';
import type { NameComparisonInput, NameMatchLevel } from '../src/data/name-evaluation';

const input: NameComparisonInput = { surname: '欧阳', candidateIds: ['an'], preferences: ['简洁'] };
const saved = () => ({ id: 'sample', createdAt: '2026-09-21T10:00:00.000Z', input, result: buildNameComparison(input) });

it('recovers local history from canonical names and facts, not stored prose', () => {
  const entry = saved();
  entry.result.source = 'ai';
  entry.result.candidates[0].fullName = '伪造姓名';
  entry.result.candidates[0].explanation = '改变命运';
  entry.result.candidates[0].dimensions[0].level = 5;
  entry.result.candidates[0].matchLevel = 1;
  const [result] = readNameEvaluations([entry]);
  expect(result.result.candidates[0]).toMatchObject({ fullName: '欧阳安', matchLevel: 5 });
  expect(result.result.candidates[0].explanation).not.toContain('改变命运');
});

it('ignores corrupted history and incompatible library versions', () => {
  const invalidLevel = saved(); invalidLevel.result.candidates[0].dimensions[0].level = 99 as NameMatchLevel;
  expect(readNameEvaluations([null, {}, invalidLevel, { ...saved(), createdAt: 'invalid' },
    { ...saved(), input: { ...input, candidateIds: ['unknown'] } },
    { ...saved(), result: { ...saved().result, libraryVersion: 'outdated' } },
  ])).toEqual([]);
  expect(readNameEvaluations('invalid JSON')).toEqual([]);
});

it('bounds history and prevents rule comparisons from retaining fabricated scores', () => {
  const entry = saved(); entry.result.candidates[0].dimensions[0].level = 5;
  const history = readNameEvaluations(Array(15).fill(entry));
  expect(history).toHaveLength(10);
  expect(history[0].result.candidates[0].matchLevel).toBeNull();
});

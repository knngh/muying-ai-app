import { isToolReviewResponse, localToolReview, MAX_SAVED_REVIEWS, readSavedReviews, reviewInputs, reviewMatches, writeSavedReviews, type SavedToolReview } from '../mini-program/src/utils/tool-review';
import type { LocalToolRecord } from '../mini-program/src/utils/tool-records';
const storage = new Map<string, unknown>();
(globalThis as unknown as { uni: unknown }).uni = { getStorageSync: (key: string) => storage.get(key), setStorageSync: (key: string, value: unknown) => storage.set(key, value) };
const record: LocalToolRecord = { id: 'w1', toolId: 'weight', recordType: 'measurement', createdAt: '2026-09-21T10:00:00Z', updatedAt: '2026-09-21T10:00:00Z', syncStatus: 'local', payload: { measuredAt: '2026-09-20', value: 61, summary: '61 kg', imagePath: '/private/not-sent' } };
const inputs = () => reviewInputs([record]);
const saved = (): SavedToolReview => ({ id: 'r1', createdAt: '2026-09-21T11:00:00Z', stage: '孕 28 周', origin: 'local', records: inputs(), result: localToolReview('孕期体重', inputs()) });
beforeEach(() => storage.clear());

it('only sends displayed text, dates and numbers; truncation is visible in the preview', () => {
  expect(JSON.stringify(inputs())).not.toContain('/private');
  const [diary] = reviewInputs([{ ...record, toolId: 'diary', payload: { content: '记'.repeat(800) } }]);
  expect(diary.content).toHaveLength(300);
  expect(diary.content.endsWith('…')).toBe(true);
});

it('detects edits with the same record ID, not just added or removed IDs', () => {
  const changed = reviewInputs([{ ...record, payload: { ...record.payload, value: 62 } }]);
  expect(reviewMatches(saved(), changed)).toBe(false);
  expect(reviewMatches(saved(), [])).toBe(false);
  expect(reviewMatches(saved(), inputs())).toBe(true);
});

it('persists separate review history and isolates tools and accounts', () => {
  writeSavedReviews('guest', 'weight', [saved()]);
  expect(readSavedReviews('guest', 'weight', inputs())).toEqual([saved()]);
  expect(readSavedReviews('123', 'weight', inputs())).toEqual([]);
  expect(readSavedReviews('guest', 'diary', inputs())).toEqual([]);
});

it('clears derived text when sources are removed and ignores corrupt storage', () => {
  writeSavedReviews('guest', 'weight', [saved()]);
  expect(readSavedReviews('guest', 'weight', [])).toEqual([]);
  expect(readSavedReviews('guest', 'weight', inputs())).toEqual([]);
  storage.set('beihu:tool-reviews:v1:guest:weight', [{ ...saved(), result: null }, null, {}]);
  expect(readSavedReviews('guest', 'weight', inputs())).toEqual([]);
});

it('bounds saved history and creates a local summary without a model', () => {
  writeSavedReviews('guest', 'weight', Array.from({ length: 15 }, (_, i) => ({ ...saved(), id: String(i) })));
  expect(readSavedReviews('guest', 'weight', inputs())).toHaveLength(MAX_SAVED_REVIEWS);
  expect(saved().result).toMatchObject({ source: 'rules', model: null, provider: null });
  expect(saved().result.summary).toContain('1 条已选记录');
});

it('rejects unusable server responses before rendering a result', () => {
  expect(isToolReviewResponse({ source: 'ai' })).toBe(false);
  expect(isToolReviewResponse({ ...saved().result, highlights: [null] })).toBe(false);
  expect(isToolReviewResponse(saved().result)).toBe(true);
});

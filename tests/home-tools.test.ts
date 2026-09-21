import { findTools, MAX_HOME_TOOLS, moveHomeTool, normalizeHomeTools, readHomeTools, recommendedHomeTools, saveHomeTools } from '../mini-program/src/utils/home-tools';
const storage = new Map<string, unknown>();
(globalThis as unknown as { uni: unknown }).uni = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: unknown) => storage.set(key, value),
};
beforeEach(() => storage.clear());
it('uses stage recommendations only before customization and preserves an intentionally empty home', () => {
  expect(readHomeTools()).toBeNull();
  expect(recommendedHomeTools('late')).toContain('contractions');
  saveHomeTools([]);
  expect(readHomeTools()).toEqual([]);
});
it('preserves the selected order across rereads and different pregnancy stages', () => {
  saveHomeTools(['reports', 'care', 'names']);
  expect(readHomeTools() ?? recommendedHomeTools('early')).toEqual(['reports', 'care', 'names']);
  expect(readHomeTools() ?? recommendedHomeTools('feeding')).toEqual(['reports', 'care', 'names']);
});
it('ignores removed or corrupt ids, deduplicates, and limits home slots', () => {
  expect(normalizeHomeTools(['reports', 'reports', 'knowledge', '__proto__', 12, 'calendar'])).toEqual(['reports', 'calendar']);
  expect(normalizeHomeTools(findTools('').map(tool => tool.id))).toHaveLength(MAX_HOME_TOOLS);
  expect(normalizeHomeTools('broken')).toBeNull();
});
it('moves tools without losing or duplicating entries and leaves boundaries intact', () => {
  const items = ['calendar', 'reports', 'names'] as const;
  expect(moveHomeTool([...items], 1, -1)).toEqual(['reports', 'calendar', 'names']);
  expect(moveHomeTool([...items], 0, -1)).toEqual(items);
  expect(moveHomeTool([...items], 2, 1)).toEqual(items);
});
it('finds all 15 tools once and supports synonyms together with category filters', () => {
  expect(findTools('')).toHaveLength(15);
  expect(new Set(findTools('').map(tool => tool.id)).size).toBe(15);
  expect(findTools('喂奶').map(tool => tool.id)).toEqual(['care']);
  expect(findTools('化验单').map(tool => tool.id)).toEqual(['reports']);
  expect(findTools('报告', 'baby')).toEqual([]);
  expect(findTools('  报告  原图 ').map(tool => tool.id)).toEqual(['reports']);
});

jest.mock('../src/config/env', () => ({}));
jest.mock('../src/services/authority-sync.service', () => ({ syncAllAuthoritySources: jest.fn() }));
jest.mock('../src/services/authority-translation.service', () => ({
  preloadAuthorityTranslationRuntimeCache: jest.fn(),
  warmPublishedAuthorityTranslations: jest.fn().mockResolvedValue({}),
}));

import { syncAllAuthoritySources } from '../src/services/authority-sync.service';
import { warmPublishedAuthorityTranslations } from '../src/services/authority-translation.service';

const sync = jest.mocked(syncAllAuthoritySources);
const warmup = jest.mocked(warmPublishedAuthorityTranslations);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it('does not start background work when imported', () => {
  jest.isolateModules(() => require('../src/workers/authority-sync.worker'));
  expect(sync).not.toHaveBeenCalled();
  expect(warmup).not.toHaveBeenCalled();
});

it('skips overlapping crawl cycles until their translation warmup finishes, then allows retry after failure', async () => {
  const { runAuthoritySyncCycle } = require('../src/workers/authority-sync.worker');
  let finishCrawl!: () => void;
  let finishWarmup!: () => void;
  sync.mockImplementationOnce(() => new Promise(resolve => { finishCrawl = () => resolve([]); }));
  warmup.mockImplementationOnce(() => new Promise(resolve => { finishWarmup = () => resolve({} as never); }));
  const first = runAuthoritySyncCycle();
  await runAuthoritySyncCycle();
  expect(sync).toHaveBeenCalledTimes(1);
  finishCrawl();
  await Promise.resolve();
  await runAuthoritySyncCycle();
  expect(sync).toHaveBeenCalledTimes(1);
  finishWarmup();
  await first;

  sync.mockRejectedValueOnce(new Error('temporary origin failure'));
  await runAuthoritySyncCycle();
  sync.mockResolvedValueOnce([] as never);
  await runAuthoritySyncCycle();
  expect(sync).toHaveBeenCalledTimes(3);
  expect(warmup).toHaveBeenCalledTimes(3);
});

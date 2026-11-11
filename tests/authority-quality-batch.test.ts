import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';

it.each([[5, 2, false], [6, 1, false], [6, 2, true]])(
  'guards live merges by checkpoint and review version (%s, %s)', async (reviewerVersion, reviewVersion, accepted) => {
    const app = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-quality-apply-'));
    const batch = path.join(app, 'data', 'quality-backfill');
    fs.mkdirSync(path.join(batch, 'items'), { recursive: true });
    const record = { question: 'Care', answer: 'Call your doctor.' };
    const translation = { translatedTitle: '照护', translatedContent: '联系您的医生。', qualityReview: { approved: true, version: reviewVersion } };
    const layout = { sourceFingerprint: translation.translatedContent, blocks: [] };
    for (const [name, data] of Object.entries({
      'authority-knowledge-cache.json': [record], 'authority-translation-cache.json': {}, 'authority-layout-cache.json': {},
      'quality-backfill/items/sample.json': { slug: 'sample', reviewerVersion, complete: true, sourceFingerprint: record.answer,
        audit: { exportable: true }, recheck: { exportable: true, translationApproved: true }, translation, layout },
    })) fs.writeFileSync(path.join(app, 'data', name), JSON.stringify(data));
    let result: { formatted: string[]; translated: string[]; skipped: unknown[] } | undefined;
    const modules: Record<string, unknown> = {
      'authority-translation.service': { normalizeAuthorityCacheRecord: (r: unknown) => r },
      'authority-identity': { buildStableAuthoritySlug: () => 'sample' },
      'authority-translation-source': { buildAuthorityTranslationSourceFingerprint: (r: typeof record) => r.answer },
      'authority-full-translation': { getAuthorityTranslationSource: (s: string) => s, validateAuthorityTranslationSegment: () => {}, validateAuthorityTranslationTerminology: () => {} },
      'knowledge-layout': { getKnowledgeLayoutSourceText: (s: string) => s, parseKnowledgeLayoutOutput: () => {} },
      'knowledge-layout.service': { buildKnowledgeLayoutSourceFingerprint: (s: string) => s },
      database: { default: { $disconnect: () => {} } },
    };
    const context: Record<string, unknown> = { __dirname: path.join(app, 'scripts'),
      process: { env: { QUALITY_APPLY_BACKUP: app, AUTHORITY_QUALITY_APPLY_DRY_RUN: 'true' } },
      console: { log: (s: string) => { result = JSON.parse(s); }, error: (e: unknown) => { throw e; } },
      require: (name: string) => name.startsWith('node:') ? require(name) : modules[path.basename(name)],
    };
    try {
      const script = fs.readFileSync(path.join(__dirname, '../scripts/apply-authority-quality-batch.cjs'), 'utf8');
      vm.runInNewContext(script.replace('(async () => {', 'globalThis.batchCompletion = (async () => {'), context);
      await context.batchCompletion;
      expect(result?.formatted).toEqual(accepted ? ['sample'] : []);
      expect(result?.translated).toEqual(accepted ? ['sample'] : []);
      expect(result?.skipped).toHaveLength(accepted ? 0 : 1);
    } finally {
      fs.rmSync(app, { recursive: true, force: true });
    }
  },
);

it('refreshes stale batch inputs and binds an approved existing translation to its layout', async () => {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-quality-batch-'));
  const batch = path.join(app, 'data', 'quality-backfill');
  fs.mkdirSync(path.join(batch, 'items'), { recursive: true });
  const record = { question: 'Newborn care', answer: 'Call your doctor.', source_language: 'en' };
  const translation = { translatedTitle: '新生儿护理', translatedSummary: '了解照护。', translatedContent: '联系您的医生。', updatedAt: '2026-11-11T00:00:00Z' };
  const write = (name: string, value: unknown) => fs.writeFileSync(path.join(app, 'data', name), JSON.stringify(value));
  write('authority-knowledge-cache.json', [record]);
  write('authority-translation-cache.json', { sample: translation });
  write('quality-backfill/source.json', [{ ...record, answer: 'Old source.' }]);
  write('quality-backfill/translations.json', { sample: { ...translation, translatedContent: '旧译文。', updatedAt: '2026-11-10T00:00:00Z' } });
  write('quality-backfill/public-list.json', [{ slug: 'removed-article' }]);
  write('quality-backfill/items/sample.json', { reviewerVersion: 6, sourceFingerprint: 'Old source.', complete: true });
  const fingerprint = (value: string) => 'fingerprint:' + value;
  const fetch = jest.fn(async () => Response.json({ data: { list: [{ slug: 'sample' }], pagination: { totalPages: 1 } } }));
  const review = { approved: true, version: 2, reviewedPasses: 2 };
  const translate = jest.fn();
  const modules: Record<string, unknown> = {
    'ai-gateway.service': { callTaskModelDetailed: async () => ({ answer: '{}', route: { provider: 'freellm', model: 'auto' } }) },
    'authority-translation-review.service': { reviewAuthorityTranslation: async () => review },
    'authority-translation.service': {
      normalizeAuthorityCacheRecord: (r: unknown) => r,
      resolveAuthorityTranslationSourceUpdatedAt: () => '',
      getCachedAuthorityTranslation: () => JSON.parse(fs.readFileSync(batch + '/translations.json', 'utf8')).sample,
      translateAuthorityRecord: translate,
    },
    'authority-identity': { buildStableAuthoritySlug: () => 'sample', buildAuthoritySlugCandidates: () => [] },
    'authority-translation-source': { buildAuthorityTranslationSourceFingerprint: (r: typeof record) => r.answer },
    'authority-full-translation': { getAuthorityTranslationSource: (s: string) => s, validateAuthorityTranslationSegment: () => {}, validateAuthorityTranslationTerminology: () => {} },
    'knowledge-layout.service': {
      KNOWLEDGE_LAYOUT_VERSION: 3, buildKnowledgeLayoutSourceFingerprint: fingerprint,
      formatKnowledgeLayoutWithAI: async (text: string) => ({ verified: true, blocks: [{ type: 'paragraph', text }], route: { model: 'auto', provider: 'freellm' } }),
    },
    'knowledge-layout': { getKnowledgeLayoutSourceText: (s: string) => s },
    'authority-ai-quality-review.service': { parseAuthorityAiQualityReviewOutput: () => ({ decision: 'publish', contentType: 'guidance', confidence: .99 }) },
  };
  const context: Record<string, unknown> = {
    __dirname: path.join(app, 'scripts'),
    process: { env: { AI_KNOWLEDGE_FORMAT_URL: 'https://freellm.invalid/v1', AUTHORITY_QUALITY_BATCH_DIR: batch } },
    console: { log: () => {}, error: (e: unknown) => { throw e; } },
    fetch, AbortSignal, Response, URL, setTimeout: () => { throw new Error('fixed model cooldown must reach the gateway fallback'); },
    require: (name: string) => name.startsWith('node:') ? require(name) : modules[path.basename(name)],
  };
  try {
    const script = fs.readFileSync(path.join(__dirname, '../scripts/review-published-authority-content.cjs'), 'utf8');
    vm.runInNewContext(script.replace('(async () => {', 'globalThis.batchCompletion = (async () => {'), context);
    await context.batchCompletion;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fs.readFileSync(batch + '/source.json', 'utf8'))).toEqual([record]);
    const result = JSON.parse(fs.readFileSync(batch + '/items/sample.json', 'utf8'));
    expect(result).toMatchObject({ complete: true, reviewerVersion: 6, sourceFingerprint: record.answer,
      translation: { ...translation, qualityReview: review }, layout: { sourceFingerprint: fingerprint(translation.translatedContent) } });
    expect(translate).not.toHaveBeenCalled();
    expect(JSON.parse(fs.readFileSync(batch + '/progress.json', 'utf8'))).toMatchObject({ event: 'finished', complete: 1, errors: 0 });
    fetch.mockResolvedValueOnce(Response.json({ error: { message: 'All models rate-limited' } }, { status: 429 }));
    await expect((context.fetch as typeof globalThis.fetch)('https://freellm.invalid/v1/chat/completions', {
      body: JSON.stringify({ model: 'gpt-oss-120b' }),
    })).resolves.toMatchObject({ status: 429 });
  } finally {
    fs.rmSync(app, { recursive: true, force: true });
  }
});

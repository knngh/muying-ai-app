import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AuthorityCacheRecord } from '../src/services/authority-translation.service';
import { buildAuthorityTranslationSourceFingerprint } from '../src/utils/authority-translation-source';

const englishSentences = [
  'Discuss your baby’s routine care with the maternity team before birth.',
  'Keep a written record of medicines and supplements taken during pregnancy, and share it with the doctor looking after your newborn.',
  'Ask the clinician to explain the benefits of each treatment and any individual medical considerations for your baby.',
];
const chineseSentences = [
  '在分娩前与产科团队讨论宝宝的常规护理。',
  '记录孕期使用的药物和补充剂，并告知照护新生儿的医生。',
  '请医生解释每项治疗的益处，以及宝宝个体的医疗情况。',
];
const finalEnglishWarning = 'A newborn may receive 1 mg of vitamin K within 6 hours after birth. Do not stop a prescribed medicine without discussing it with your doctor.';
const finalChineseWarning = '新生儿可在出生后6小时内接受1 mg维生素K。未与医生讨论前，不要自行停用处方药。';
const longBody = [
  ...Array.from({ length: 24 }, (_, index) => 'Care section ' + (index + 1) + '. ' + englishSentences.join(' ')),
  finalEnglishWarning,
].join('\n\n');
const source: AuthorityCacheRecord = {
  id: 'full-translation-newborn-regression',
  source_id: 'acog',
  source_org: 'ACOG',
  source_url: 'https://www.acog.org/womens-health/experts-and-stories/ask-acog/newborn-care-full-translation-regression',
  source_language: 'en',
  question: 'What should parents know about routine newborn care?',
  summary: 'Discuss newborn care, medicines, and vitamin K with your maternity team.',
  answer: longBody,
  source_updated_at: '2026-11-01T00:00:00.000Z',
};
const squashWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

it('decodes punctuation and numeric HTML entities before checking medical numbers', () => {
  const { getAuthorityTranslationSource, validateAuthorityTranslationSegment } = require('../src/utils/authority-full-translation');
  const text = getAuthorityTranslationSource('Baby&rsquo;s care &#8212; use 1 mg &plusmn; 0.1 mg.');
  expect(text).toBe('Baby’s care — use 1 mg ± 0.1 mg.');
  expect(() => validateAuthorityTranslationSegment(text, '宝宝护理——使用1 mg ± 0.1 mg。')).not.toThrow();
});

it('accepts equivalent thousands separators while retaining decimal medical doses', () => {
  const { validateAuthorityTranslationSegment } = require('../src/utils/authority-full-translation');
  expect(() => validateAuthorityTranslationSegment('Take 1,000 mg, not 0.5 mg.', '服用1000 mg，而不是0.5 mg。')).not.toThrow();
  expect(() => validateAuthorityTranslationSegment('Take 0.5 mg.', '服用5 mg。')).toThrow('0.5');
});

it('reports the exact missing numeric facts so a retry can repair them', () => {
  const { validateAuthorityTranslationSegment } = require('../src/utils/authority-full-translation');
  expect(() => validateAuthorityTranslationSegment('Give 2 mg within 6 hours.', '在6小时内给药。')).toThrow('缺失：2');
});

it('rejects an observed reversal of fetal anatomical movement', () => {
  const { validateAuthorityTranslationTerminology } = require('../src/utils/authority-full-translation');
  const source = 'In boys, the testes have begun to descend into the scrotum.';
  expect(() => validateAuthorityTranslationTerminology(source, '在男孩中，睾丸已开始从阴囊下降。')).toThrow();
  expect(() => validateAuthorityTranslationTerminology(source, '在男孩中，睾丸已开始下降进入阴囊。')).not.toThrow();
});

function mockTranslation(body: string) {
  let translated = body.replace(/Care section (\d+)\./g, '第$1节照护。');
  englishSentences.forEach((sentence, index) => {
    translated = translated.replaceAll(sentence, chineseSentences[index]);
  });
  return {
    answer: JSON.stringify({
      translated_title: '家长应了解哪些新生儿常规护理？',
      translated_summary: '与产科团队讨论新生儿护理、用药及维生素K，并了解每项治疗的益处。',
      translated_content: translated.replace(finalEnglishWarning, finalChineseWarning),
    }),
    route: { provider: 'freellm', model: 'translation-fixture', route: 'task' as const, label: 'translation-fixture' },
  };
}

describe('complete authority article translation', () => {
  const envKeys = [
    'AUTHORITY_KNOWLEDGE_CACHE_PATH',
    'AUTHORITY_TRANSLATION_CACHE_PATH',
    'AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH',
    'AUTHORITY_TRANSLATION_SOURCE_CHAR_LIMIT',
    'AUTHORITY_TRANSLATION_TASK_ROLES',
    'AUTHORITY_TRANSLATION_QUALITY_REVIEW_ENABLED',
  ] as const;
  let originalEnv: Record<string, string | undefined>;
  let directory: string;
  let translationCachePath: string;

  beforeEach(() => {
    originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'authority-full-translation-'));
    translationCachePath = path.join(directory, 'authority-translation-cache.json');
    process.env.AUTHORITY_KNOWLEDGE_CACHE_PATH = path.join(directory, 'authority-knowledge-cache.json');
    process.env.AUTHORITY_TRANSLATION_CACHE_PATH = translationCachePath;
    process.env.AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH = path.join(directory, 'authority-translation-failures.json');
    process.env.AUTHORITY_TRANSLATION_SOURCE_CHAR_LIMIT = '3200';
    process.env.AUTHORITY_TRANSLATION_TASK_ROLES = 'deepseek_translate';
    delete process.env.AUTHORITY_TRANSLATION_QUALITY_REVIEW_ENABLED;
    fs.writeFileSync(process.env.AUTHORITY_KNOWLEDGE_CACHE_PATH, JSON.stringify([source]), 'utf8');
    fs.writeFileSync(translationCachePath, '{}', 'utf8');
    fs.writeFileSync(process.env.AUTHORITY_TRANSLATION_FAILURE_CACHE_PATH, '{}', 'utf8');
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    fs.rmSync(directory, { recursive: true, force: true });
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  function loadService() {
    const gateway = require('../src/services/ai-gateway.service') as typeof import('../src/services/ai-gateway.service');
    const callModel = jest.spyOn(gateway, 'callTaskModelDetailed')
      .mockRejectedValue(new Error('Unexpected model invocation in an offline translation regression test'));
    const service = require('../src/services/authority-translation.service') as typeof import('../src/services/authority-translation.service');
    return { callModel, service };
  }

  function sourceBodyFromMessages(messages: Array<{ role: string; content: string }>): string {
    const userContent = messages.find(message => message.role === 'user')?.content || '';
    const body = userContent.match(/原文正文[^：\n]*：\s*([\s\S]*)$/u)?.[1];
    expect(body).toBeDefined();
    return body!.trim();
  }

  function legacyCachedTranslation(slug: string, record = source) {
    return {
      slug,
      sourceUpdatedAt: record.source_updated_at,
      sourceFingerprint: buildAuthorityTranslationSourceFingerprint(record),
      translatedTitle: '新生儿护理',
      translatedSummary: '了解新生儿护理。',
      translatedContent: '这份旧译文只包含文章开头的护理介绍。',
      translationNotice: '缓存译文',
      updatedAt: '2026-11-02T00:00:00.000Z',
      model: 'legacy-fixture',
      provider: 'fixture',
    };
  }

  it('upgrades old translations in background when independent review is enabled', async () => {
    process.env.AUTHORITY_TRANSLATION_QUALITY_REVIEW_ENABLED = 'true';
    const record = { ...source, id: 'full-translation-quality-upgrade', answer: longBody.replace(/\s+/g, ' ') };
    const { buildStableAuthoritySlug } = require('../src/utils/authority-identity');
    const { getAuthorityTranslationSource } = require('../src/utils/authority-full-translation');
    const slug = buildStableAuthoritySlug(record, 0);
    fs.writeFileSync(process.env.AUTHORITY_KNOWLEDGE_CACHE_PATH!, JSON.stringify([record]));
    fs.writeFileSync(translationCachePath, JSON.stringify({ [slug]: {
      ...legacyCachedTranslation(slug, record), translatedContent: JSON.parse(mockTranslation(record.answer).answer).translated_content,
      translationCoverage: 'full', translationVersion: 2, sourceChars: getAuthorityTranslationSource(record.answer).length, translatedChunks: 3,
    } }));
    const { callModel, service } = loadService();
    expect(service.getCachedAuthorityTranslation(slug, record.source_updated_at, buildAuthorityTranslationSourceFingerprint(record), [], record.answer)).toBeTruthy();
    callModel.mockImplementation(async (role, messages) => role === 'knowledge_review' ? {
      answer: JSON.stringify({ approved: true, confidence: 1, issues: [] }),
      route: { provider: 'freellm', model: 'review-fixture', route: 'task', label: 'review-fixture' },
    } : mockTranslation(sourceBodyFromMessages(messages)));
    const result = await service.warmPublishedAuthorityTranslations({ limit: 1, delayMs: 0 });
    expect(result.warmed).toBe(1);
    expect(result.cached).toBe(0);
    expect(Object.values(service.loadAuthorityTranslationCache()).some(item => item.qualityReview?.approved)).toBe(true);
  });

  it('translates every source segment, preserves the final medical warning, and saves only the completed article', async () => {
    expect(longBody.length).toBeGreaterThan(6500);
    const slug = 'authority-full-translation-success';
    const { callModel, service } = loadService();
    const submittedBodies: string[] = [];
    const writes = jest.spyOn(fs, 'writeFileSync');
    callModel.mockImplementation(async (_role, messages) => {
      expect(service.loadAuthorityTranslationCache()[slug]).toBeUndefined();
      expect(JSON.parse(fs.readFileSync(translationCachePath, 'utf8'))[slug]).toBeUndefined();
      const body = sourceBodyFromMessages(messages);
      submittedBodies.push(body);
      return mockTranslation(body);
    });

    const result = await service.translateAuthorityRecord(slug, source);

    expect(submittedBodies.length).toBeGreaterThan(2);
    expect(submittedBodies.every(body => body.length <= 3200)).toBe(true);
    expect(squashWhitespace(submittedBodies.join('\n\n'))).toBe(squashWhitespace(longBody));
    for (let section = 1; section <= 24; section += 1) {
      expect(result.translatedContent).toContain('第' + section + '节照护。');
    }
    expect(result.translatedContent).toContain(finalChineseWarning);
    expect(result).toMatchObject({
      translationCoverage: 'full',
      translationVersion: 2,
      sourceChars: longBody.length,
      translatedChunks: submittedBodies.length,
    });
    const articleWrites = writes.mock.calls.filter(([pathname]) => String(pathname) === translationCachePath);
    expect(articleWrites).toHaveLength(1);
    expect(JSON.parse(String(articleWrites[0][1]))[slug]).toEqual(result);
    expect(JSON.parse(fs.readFileSync(translationCachePath, 'utf8'))[slug]).toEqual(result);
  });

  it('retries incomplete freellm output as JSON before using another provider', async () => {
    process.env.AUTHORITY_TRANSLATION_TASK_ROLES = 'knowledge_translate,deepseek_translate';
    const slug = 'authority-full-translation-model-fallback';
    const { callModel, service } = loadService();
    const roles: string[] = [];
    callModel.mockImplementation(async (role, messages, options) => {
      roles.push(role);
      expect(options).toMatchObject({ responseFormat: 'json_object', thinking: 'disabled' });
      const body = sourceBodyFromMessages(messages);
      if (role === 'knowledge_translate' && roles.length === 1) {
        return {
          answer: JSON.stringify({ translated_title: '新生儿护理', translated_summary: '了解护理。', translated_content: '译文过短。' }),
          route: { provider: 'freellm', model: 'fixture', route: 'task' as const, label: 'fixture' },
        };
      }
      return mockTranslation(body);
    });

    const result = await service.translateAuthorityRecord(slug, source);

    expect(roles.slice(0, 2)).toEqual(['knowledge_translate', 'knowledge_translate']);
    expect(roles).not.toContain('deepseek_translate');
    expect(result.translatedContent).toContain(finalChineseWarning);
    expect(result.translationCoverage).toBe('full');
  });

  it('rejects missing numeric facts in short articles and retries before caching', async () => {
    process.env.AUTHORITY_TRANSLATION_TASK_ROLES = 'knowledge_translate';
    const { callModel, service } = loadService();
    const body = 'A newborn may receive 1 mg of vitamin K within 6 hours after birth. Do not stop a prescribed medicine without discussing it with your doctor.';
    callModel.mockResolvedValueOnce({
      answer: JSON.stringify({ translated_title: '新生儿护理', translated_summary: '了解新生儿护理。', translated_content: '新生儿可接受维生素K，未咨询医生前不要停用处方药。' }),
      route: { provider: 'freellm', model: 'auto', route: 'task', label: 'fixture' },
    }).mockResolvedValue({
      answer: JSON.stringify({ translated_title: '新生儿护理', translated_summary: '了解新生儿护理。', translated_content: finalChineseWarning }),
      route: { provider: 'freellm', model: 'auto', route: 'task', label: 'fixture' },
    });
    const result = await service.translateAuthorityRecord('short-numbers', { ...source, answer: body });
    expect(callModel).toHaveBeenCalledTimes(2);
    expect(result.translatedContent).toBe(finalChineseWarning);
  });

  it('retranslates a clinical meaning error found by the independent reviewer', async () => {
    process.env.AUTHORITY_TRANSLATION_TASK_ROLES = 'knowledge_translate';
    process.env.AUTHORITY_TRANSLATION_QUALITY_REVIEW_ENABLED = 'true';
    const { callModel, service } = loadService();
    let reviews = 0;
    callModel.mockImplementation(async role => ({
      answer: role === 'knowledge_review'
        ? JSON.stringify({ approved: ++reviews > 2, confidence: 0.96, issues: reviews > 2 ? [] : [{ sourceQuote: finalEnglishWarning, translationQuote: finalChineseWarning, problem: '遗漏不要自行停药的警告' }] })
        : JSON.stringify({ translated_title: '新生儿护理', translated_summary: '与医生讨论用药。', translated_content: finalChineseWarning }),
      route: { provider: 'freellm', model: 'auto', route: 'task', label: 'fixture' },
    }));
    const result = await service.translateAuthorityRecord('meaning-review', { ...source, answer: finalEnglishWarning });
    expect(callModel.mock.calls.map(call => call[0])).toEqual(['knowledge_translate', 'knowledge_review', 'knowledge_review', 'knowledge_translate', 'knowledge_review']);
    expect(result.qualityReview).toMatchObject({ approved: true, reviewedChunks: 1 });
  });

  it('allows an explicit repair to replace a matching cache rather than silently reuse it', async () => {
    const slug = 'forced-repair';
    const record = { ...source, answer: finalEnglishWarning };
    fs.writeFileSync(translationCachePath, JSON.stringify({ [slug]: legacyCachedTranslation(slug, record) }), 'utf8');
    const { callModel, service } = loadService();
    callModel.mockResolvedValue({ answer: JSON.stringify({ translated_title: '新生儿护理', translated_summary: '与医生讨论用药。', translated_content: finalChineseWarning }),
      route: { provider: 'freellm', model: 'auto', route: 'task', label: 'fixture' } });
    const result = await service.translateAuthorityRecord(slug, record, { force: true });
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(result.translatedContent).toBe(finalChineseWarning);
  });

  it('does not save a partial translation when a later source segment fails', async () => {
    const slug = 'authority-full-translation-failure';
    const { callModel, service } = loadService();
    const writes = jest.spyOn(fs, 'writeFileSync');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    let calls = 0;
    callModel.mockImplementation(async (_role, messages) => {
      calls += 1;
      if (calls > 1) throw new Error('The second source segment failed');
      return mockTranslation(sourceBodyFromMessages(messages));
    });

    await expect(service.translateAuthorityRecord(slug, source)).rejects.toThrow('The second source segment failed');

    expect(calls).toBeGreaterThanOrEqual(2);
    expect(service.loadAuthorityTranslationCache()[slug]).toBeUndefined();
    expect(JSON.parse(fs.readFileSync(translationCachePath, 'utf8'))[slug]).toBeUndefined();
    expect(writes.mock.calls.filter(([pathname]) => String(pathname) === translationCachePath)).toHaveLength(0);
  });

  it.each([
    ['Cytomegalovirus (CMV) in Pregnancy', 'Cytomegalovirus (CMV) is a herpesvirus.', '妊娠期单纯疱疹病毒（CMV）', '单纯疱疹病毒（CMV）是一种疱疹病毒。', '妊娠期巨细胞病毒（CMV）', '巨细胞病毒（CMV）是一种疱疹病毒。'],
    ['Acetaminophen and Pregnancy', 'Talk with your doctor before taking acetaminophen.', '乙醇酰胺与孕期', '服用乙醇酰胺前请咨询医生。', '对乙酰氨基酚与孕期', '服用对乙酰氨基酚前请咨询医生。'],
    ['Newborn Male Circumcision', 'Circumcision is an elective procedure.', '新生儿阴茎环龄手术', '阴茎环龄手术是选择性手术。', '新生儿包皮环切术', '包皮环切术是选择性手术。'],
    ['Valacyclovir', 'Valacyclovir is discussed in this article.', '伐昔洛韦', '伐昔洛韦又称万拉西韦。', '伐昔洛韦', '本文讨论伐昔洛韦。'],
  ])('rejects a known mistranslation of %s and uses the next model before caching', async (question, answer, wrongTitle, wrongBody, correctTitle, correctBody) => {
    process.env.AUTHORITY_TRANSLATION_TASK_ROLES = 'knowledge_translate,deepseek_translate';
    const { callModel, service } = loadService();
    const slug = 'authority-terminology-regression';
    callModel.mockImplementation(async role => ({
      answer: JSON.stringify({ translated_title: role === 'knowledge_translate' ? wrongTitle : correctTitle,
        translated_summary: '了解权威机构的健康指导。', translated_content: role === 'knowledge_translate' ? wrongBody : correctBody }),
      route: { provider: role === 'knowledge_translate' ? 'freellm' : 'deepseek', model: 'fixture', route: 'task' as const, label: 'fixture' },
    }));
    const result = await service.translateAuthorityRecord(slug, { ...source, question, answer });
    expect(result.translatedTitle).toBe(correctTitle);
    expect(result.translatedContent).toBe(correctBody);
    expect(JSON.parse(fs.readFileSync(translationCachePath, 'utf8'))[slug].translatedContent).toBe(correctBody);
  });

  it('retranslates a long article whose matching legacy cache does not establish full coverage', async () => {
    const slug = 'authority-full-translation-legacy-long';
    fs.writeFileSync(translationCachePath, JSON.stringify({ [slug]: legacyCachedTranslation(slug) }), 'utf8');
    const { callModel, service } = loadService();
    callModel.mockImplementation(async (_role, messages) => mockTranslation(sourceBodyFromMessages(messages)));

    const result = await service.translateAuthorityRecord(slug, source);

    expect(callModel).toHaveBeenCalled();
    expect(result.translatedContent).toContain(finalChineseWarning);
    expect(result).toMatchObject({ translationCoverage: 'full', translationVersion: 2 });
    expect(JSON.parse(fs.readFileSync(translationCachePath, 'utf8'))[slug]).toEqual(result);
  });

  it('continues to reuse a matching legacy cache for an article that fits in one source segment', async () => {
    const slug = 'authority-full-translation-legacy-short';
    const shortSource = { ...source, answer: englishSentences.join(' ') };
    const cached = legacyCachedTranslation(slug, shortSource);
    fs.writeFileSync(translationCachePath, JSON.stringify({ [slug]: cached }), 'utf8');
    const { callModel, service } = loadService();

    const result = await service.translateAuthorityRecord(slug, shortSource);

    expect(callModel).not.toHaveBeenCalled();
    expect(result.translatedContent).toBe(cached.translatedContent);
  });
});

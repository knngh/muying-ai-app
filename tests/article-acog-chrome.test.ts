import fs from 'fs';
import { Request, Response } from 'express';
import { getArticleBySlug } from '../src/controllers/article.controller';
import { callTaskModelDetailed } from '../src/services/ai-gateway.service';
import {
  buildKnowledgeLayoutSourceFingerprint,
  getCachedKnowledgeReadingLayout,
} from '../src/services/knowledge-layout.service';
import { textToRichParagraphHtml } from '../src/utils/article-format';
import { buildStableAuthoritySlug } from '../src/utils/authority-identity';
import { getKnowledgeLayoutSourceText } from '../src/utils/knowledge-layout';

jest.mock('fs');
jest.mock('node:fs', () => jest.requireMock('fs'));
jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: { $queryRawUnsafe: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../src/services/ai-gateway.service', () => ({
  callTaskModelDetailed: jest.fn().mockRejectedValue(new Error('No model calls in this cache regression test')),
}));

const mockedFs = jest.mocked(fs);
const medicalBody = [
  'Vitamin K helps the blood of newborn babies clot normally.',
  'A newborn may receive a 1 mg vitamin K shot within 6 hours after birth.',
  'Your doctor can explain the benefits of vitamin K for your baby and discuss any questions before the injection.',
  'Before your baby is born, speak with the maternity team about the routine care that will be offered after delivery.',
  'Tell the doctor about any medicines or supplements taken during pregnancy so that the team has the information it needs.',
  'Ask the maternity team to explain how the vitamin K injection is given and how your baby will be supported.',
  'Parents can write down their questions before the appointment and ask for clarification if a recommendation is difficult to understand.',
  'The discussion should include the benefits of the injection, the care planned for your newborn, and any individual medical considerations.',
  'Keep a record of the care your baby receives after birth and share that information with the clinician providing follow-up care.',
  'If you have more questions after going home, contact your maternity team or the doctor who looks after your baby.',
  'During the conversation, ask how the team will document the care provided to your newborn and who you should contact with follow-up questions.',
  'Share your questions with the clinician before a decision is made so that you understand the explanation and the plan for your baby.',
  'If another family member will help with newborn care, ask whether they can join the discussion and help keep track of information.',
  'Before leaving the maternity unit, check that you know when the next appointment is planned and how to reach the team if needed.',
  'At follow-up, bring the record of newborn care and any questions that have come up at home.',
  'The clinician can review the record with you and explain any recommendations for your baby.',
].join('\n');
const translatedMedicalBody = [
  '维生素K帮助新生儿的血液正常凝固。',
  '新生儿可在出生后6小时内接受1 mg维生素K注射。',
  '医生可以解释维生素K对宝宝的益处，并在注射前讨论您的问题。',
  '宝宝出生前，可以与产科团队讨论分娩后提供的常规护理。',
  '告知医生孕期使用的药物或补充剂，以便团队获得需要的信息。',
  '请产科团队解释维生素K注射的过程，以及如何照护宝宝。',
  '家长可以提前写下问题，对于难以理解的建议请医生进一步解释。',
  '讨论应包括注射的益处、新生儿护理计划，以及个体医疗情况。',
  '保存宝宝出生后接受护理的记录，并向提供随访服务的医生说明。',
  '回家后如有更多问题，请联系产科团队或照护宝宝的医生。',
  '沟通时，请询问团队如何记录新生儿接受的护理，以及随访问题应联系谁。',
  '作出决定前向医生提出问题，确保理解相关解释和宝宝的护理计划。',
  '如果有家人协助照护新生儿，可以询问他们能否参与讨论并帮助记录信息。',
  '离开产科病房前，确认下次就诊时间，以及需要时如何联系团队。',
  '随访时带上新生儿护理记录和回家后遇到的问题。医生可以一起查看记录，并解释针对宝宝的建议。',
].join('\n');
const relatedQuestionsUrl = 'https://www.acog.org/womens-health/experts-and-stories/ask-acog';
const legacyTranslatedContent = [
  translatedMedicalBody,
  '推荐阅读',
  '问 ACOG',
  relatedQuestionsUrl,
  '关于问ACOG',
  'ACOG在这里为您提供答案，帮助您保持健康。浏览所有问题。',
].join('\n\n');
const source = {
  id: 'authority-acog-vitamin-k-sample',
  source_id: 'acog',
  source_org: 'ACOG',
  source_url: `${relatedQuestionsUrl}/does-my-newborn-need-a-vitamin-k-shot`,
  source_language: 'en',
  question: 'Does my newborn need a vitamin K shot?',
  summary: 'Vitamin K helps the blood of newborn babies clot normally. Ask your doctor about the vitamin K shot after birth.',
  answer: [
    medicalBody,
    'About Ask ACOG',
    'ACOG is here with answers to help you stay healthy. Browse all questions.',
    'What to Read Next',
    'Ask ACOG',
    relatedQuestionsUrl,
  ].join('\n\n'),
  created_at: '2026-11-01',
  source_updated_at: '2026-11-01',
  published_at: '2026-11-01',
  region: 'US',
  audience: '新生儿家长',
  topic: 'newborn',
  category: 'newborn',
  is_verified: true,
};

it('cleans source and legacy translation chrome on a public article read and invalidates the old layout', async () => {
  const originalLayoutEnabled = process.env.KNOWLEDGE_AI_LAYOUT_ENABLED;
  process.env.KNOWLEDGE_AI_LAYOUT_ENABLED = 'true';
  try {
    const slug = buildStableAuthoritySlug(source, 0);
    const legacyHtml = textToRichParagraphHtml(legacyTranslatedContent);
    const legacyLayoutSource = getKnowledgeLayoutSourceText(legacyHtml)!;
    const files: Record<string, unknown> = {
      'authority-knowledge-cache.json': [source],
      'authority-translation-cache.json': {
        [slug]: {
          slug,
          sourceUpdatedAt: source.source_updated_at,
          translatedTitle: '我的新生儿需要注射维生素K吗？',
          translatedSummary: '维生素K帮助新生儿的血液正常凝固，家长可以向医生咨询出生后注射维生素K的益处。',
          translatedContent: legacyTranslatedContent,
          translationNotice: '来自权威机构原文的中文译文。',
          updatedAt: '2026-11-09T00:00:00Z',
          model: 'fixture',
          provider: 'fixture',
        },
      },
      'authority-layout-cache.json': {
        [slug]: {
          slug,
          sourceFingerprint: buildKnowledgeLayoutSourceFingerprint(legacyLayoutSource),
          blocks: [{ type: 'paragraph', text: legacyLayoutSource }],
          updatedAt: '2026-11-09T00:00:00Z',
          model: 'fixture',
          provider: 'fixture',
        },
      },
    };
    const findFile = (pathname: unknown) => Object.keys(files).find(name => String(pathname).endsWith(name));
    mockedFs.existsSync.mockImplementation(pathname => Boolean(findFile(pathname)));
    mockedFs.statSync.mockImplementation(() => ({ mtimeMs: 1, size: 1000 }) as fs.Stats);
    mockedFs.readFileSync.mockImplementation(pathname => JSON.stringify(files[findFile(pathname) || ''] || {}));

    // Prove this is a usable layout for the old text, rather than a malformed fixture.
    expect(getCachedKnowledgeReadingLayout(slug, legacyHtml)?.verified).toBe(true);

    const req = {
      params: { slug },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const json = jest.fn();
    const next = jest.fn();
    await getArticleBySlug(req, { json } as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledTimes(1);
    const article = json.mock.calls[0][0].data;
    const sourceText = getKnowledgeLayoutSourceText(article.content)!;
    const displayText = getKnowledgeLayoutSourceText(article.displayContent)!;
    const translationText = article.translation.translatedContent;
    for (const sentence of medicalBody.split('\n')) expect(sourceText).toContain(sentence);
    for (const sentence of translatedMedicalBody.split('\n')) {
      expect(displayText).toContain(sentence);
      expect(translationText).toContain(sentence);
    }
    expect({
      sourceChrome: /About Ask ACOG|Browse all questions|What to Read Next/.test(sourceText),
      displayChrome: /推荐阅读|问\s*ACOG|ACOG在这里为您提供答案|浏览所有问题/.test(displayText),
      translationChrome: /推荐阅读|问\s*ACOG|ACOG在这里为您提供答案|浏览所有问题/.test(translationText),
      sourceHasRelatedLink: sourceText.includes(relatedQuestionsUrl),
      displayHasRelatedLink: displayText.includes(relatedQuestionsUrl),
      translationHasRelatedLink: translationText.includes(relatedQuestionsUrl),
      readingLayout: article.readingLayout,
    }).toEqual({
      sourceChrome: false,
      displayChrome: false,
      translationChrome: false,
      sourceHasRelatedLink: false,
      displayHasRelatedLink: false,
      translationHasRelatedLink: false,
      readingLayout: null,
    });
    expect(callTaskModelDetailed).not.toHaveBeenCalled();
  } finally {
    if (originalLayoutEnabled === undefined) delete process.env.KNOWLEDGE_AI_LAYOUT_ENABLED;
    else process.env.KNOWLEDGE_AI_LAYOUT_ENABLED = originalLayoutEnabled;
    jest.restoreAllMocks();
  }
});

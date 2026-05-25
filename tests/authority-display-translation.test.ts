import { resolveChineseTranslationDisplayFields } from '../src/utils/article-translation';

describe('authority display translation fields', () => {
  test('derives Chinese title and summary when cached title and summary are still English', () => {
    const display = resolveChineseTranslationDisplayFields({
      sourceTitle: 'Skin-to-Skin Contact: How Kangaroo Care Benefits Your Baby',
      sourceSummary: 'The American Academy of Pediatrics discusses the benefits of skin-to-skin care.',
      translatedTitle: 'Skin-to-Skin Contact: How Kangaroo Care Benefits Your Baby',
      translatedSummary: 'The American Academy of Pediatrics discusses the benefits of skin-to-skin care.',
      translatedContent: [
        '肌肤接触：袋鼠式护理如何惠及您的宝宝',
        '美国儿科学会（AAP）探讨了肌肤接触对早产儿的积极益处。',
        '一旦您能够抱起新生儿，尤其是早产宝宝，可以尝试袋鼠式护理。',
      ].join('\n'),
    });

    expect(display.displayTitle).toBe('肌肤接触：袋鼠式护理如何惠及您的宝宝');
    expect(display.displaySummary).toBe('美国儿科学会（AAP）探讨了肌肤接触对早产儿的积极益处。');
  });

  test('skips author bylines when deriving a Chinese title from translated content', () => {
    const display = resolveChineseTranslationDisplayFields({
      sourceTitle: 'Breast Milk Storage Tips',
      sourceSummary: 'English summary.',
      translatedTitle: 'Breast Milk Storage Tips',
      translatedSummary: 'English summary.',
      translatedContent: [
        '作者：Dina DiMaggio，医学博士，FAAP',
        '母乳冷冻与冷藏小贴士',
        '美国儿科学会（AAP）提供了关于如何安全储存和准备母乳的指南。',
      ].join('\n'),
    });

    expect(display.displayTitle).toBe('母乳冷冻与冷藏小贴士');
    expect(display.displaySummary).toBe('美国儿科学会（AAP）提供了关于如何安全储存和准备母乳的指南。');
  });
});

import { segmentArticleText, textToRichParagraphHtml } from '../src/utils/article-format';

describe('article paragraph formatting', () => {
  test('splits dense Chinese authority text into readable paragraphs', () => {
    const input = '孩子发热后先测体温并观察精神状态。如体温持续升高或伴随呼吸急促、精神差，应尽快就医。居家期间注意补液、少量多次饮水，并记录发热持续时间。';
    const paragraphs = segmentArticleText(input);

    expect(paragraphs.length).toBeGreaterThan(1);
    expect(paragraphs[0]).toContain('先测体温');
    expect(paragraphs.join(' ')).toContain('尽快就医');
  });

  test('keeps headings and numbered sections separate', () => {
    const input = '一、日常护理保持室内通风，注意补液。（二）何时就医如果出现精神差、抽搐或呼吸困难，应立即就医。';
    const paragraphs = segmentArticleText(input);

    expect(paragraphs[0]).toBe('一、日常护理');
    expect(paragraphs).toContain('（二）何时就医');
  });

  test('renders segmented text as paragraph html', () => {
    const html = textToRichParagraphHtml('建议先观察精神状态。若持续加重，应及时就医。');

    expect(html).toContain('<p style=');
    expect(html.match(/<p style=/g)?.length).toBeGreaterThan(1);
  });
});

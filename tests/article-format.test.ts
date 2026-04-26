import {
  addArticleHeadingAnchors,
  extractArticleOutline,
  formatRichArticleContent,
  segmentArticleText,
  textToRichParagraphHtml,
} from '../src/utils/article-format';

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
    expect(html).toContain('text-align:justify');
    expect(html).toContain('text-align-last:left');
  });

  test('preserves table html instead of flattening it to plain text', () => {
    const html = formatRichArticleContent('<table><tr><th>项目</th><td>内容</td></tr></table>');

    expect(html).toContain('article-table-wrap');
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('<td');
  });

  test('preserves inline images and adds responsive display styles', () => {
    const html = formatRichArticleContent('<p>正文</p><img src="https://example.com/test.jpg" alt="配图">');

    expect(html).toContain('<img');
    expect(html).toContain('max-width:100%');
    expect(html).toContain('border-radius:16px');
  });

  test('adds justified reading styles to html blocks while keeping headings left aligned', () => {
    const html = formatRichArticleContent('<h2>护理建议</h2><p>正文内容</p><blockquote>提示内容</blockquote>');

    expect(html).toContain('text-align:justify');
    expect(html).toContain('text-align:left');
    expect(html).toContain('<blockquote');
  });

  test('extracts article outline and injects stable heading anchors', () => {
    const raw = '<h2>护理建议</h2><p>正文</p><h3>何时就医</h3>';
    const outline = extractArticleOutline(raw);
    const html = addArticleHeadingAnchors(formatRichArticleContent(raw));

    expect(outline).toEqual([
      { id: 'article-section-1', title: '护理建议', level: 2 },
      { id: 'article-section-2', title: '何时就医', level: 3 },
    ]);
    expect(html).toContain('id="article-section-1"');
    expect(html).toContain('id="article-section-2"');
  });
});

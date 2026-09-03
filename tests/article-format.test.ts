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
    const html = textToRichParagraphHtml('建议先观察精神状态。若持续加重，应及时就医。继续记录症状变化。');

    expect(html).toContain('<p style=');
    expect(html.match(/<p style=/g)?.length).toBeGreaterThan(1);
    expect(html).toContain('text-align:justify');
    expect(html).toContain('text-align-last:left');
  });

  test('formats English authority copy into sentences and section headings', () => {
    const input = 'Vaccines help protect children from serious diseases. HOW VACCINES WORK Vaccines teach the body how to defend itself. The immune system learns to recognize germs. A third sentence confirms the body response. WHY WE NEED VACCINES Babies have some protection after birth.';
    const segments = segmentArticleText(input);
    const html = textToRichParagraphHtml(input);

    expect(segments).toEqual(expect.arrayContaining([
      'Vaccines help protect children from serious diseases.',
      'HOW VACCINES WORK',
      'WHY WE NEED VACCINES',
    ]));
    expect(html).toContain('<h2');
    expect(html).toContain('HOW VACCINES WORK');
    expect(html).toContain('WHY WE NEED VACCINES');
    expect(html.match(/<p /g)?.length).toBeGreaterThan(1);
    expect(segments).toContain('Vaccines teach the body how to defend itself.');
    expect(segments).toContain('The immune system learns to recognize germs.');
    expect(segments).toContain('A third sentence confirms the body response.');
  });

  test('recognizes single-word English headings and avoids splitting abbreviations', () => {
    const segments = segmentArticleText('VACCINE SCHEDULE The A.D.A.M. editorial team reviewed this page. TRAVELERS Bring your record when you travel.');

    expect(segments).toEqual(expect.arrayContaining([
      'VACCINE SCHEDULE',
      'The A.D.A.M. editorial team reviewed this page.',
      'TRAVELERS',
    ]));
  });

  test('recognizes stable Chinese headings embedded in translated authority copy', () => {
    const input = '疫苗用于增强免疫系统。疫苗如何工作 疫苗模拟感染以触发自然防御。为什么我们需要疫苗 出生后几周内，婴儿有一些保护。疫苗的安全性 疫苗的益处超过风险。';
    const segments = segmentArticleText(input);
    const html = textToRichParagraphHtml(input);

    expect(segments).toEqual(expect.arrayContaining([
      '疫苗如何工作',
      '为什么我们需要疫苗',
      '疫苗的安全性',
    ]));
    expect((html.match(/<h2 /g) || []).length).toBe(3);
  });

  test('keeps plain-text bullet points as a readable list', () => {
    const html = textToRichParagraphHtml('- Keep the area clean\n- Watch for warning signs');

    expect(html).toContain('<ul');
    expect(html.match(/<li /g)?.length).toBe(2);
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

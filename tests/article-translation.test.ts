import {
  extractJsonObject,
  hasTranslationPromptLeak,
  isPlaceholderTranslationText,
  sanitizeTranslationText,
} from '../src/utils/article-translation';

describe('article translation sanitization', () => {
  test('strips code fences and label prefixes from translation fields', () => {
    const input = '```markdown\n标题：孕期发热如何处理\n```';

    expect(sanitizeTranslationText(input, 'title')).toBe('孕期发热如何处理');
  });

  test('returns empty string when translation leaks prompt template', () => {
    const input = 'Be accurate and faithful to the original\n<translated_content>正文</translated_content>';

    expect(sanitizeTranslationText(input, 'content')).toBe('');
    expect(hasTranslationPromptLeak(input)).toBe(true);
  });

  test('returns empty string for placeholder translation output', () => {
    expect(sanitizeTranslationText('...', 'content')).toBe('');
    expect(sanitizeTranslationText('…', 'summary')).toBe('');
    expect(isPlaceholderTranslationText('待翻译')).toBe(true);
  });

  test('extracts json object from fenced response payload', () => {
    const payload = [
      '```json',
      '{"translated_title":"中文标题","translated_summary":"中文摘要","translated_content":"第一段。第二段。"}',
      '```',
    ].join('\n');

    expect(extractJsonObject(payload)).toEqual({
      translated_title: '中文标题',
      translated_summary: '中文摘要',
      translated_content: '第一段。第二段。',
    });
  });
});

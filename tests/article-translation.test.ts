import {
  extractJsonObject,
  compactTranslationSummary,
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

  test('returns empty string for chain-of-thought or instruction leakage', () => {
    const input = [
      '<think>',
      'Let me translate carefully and accurately.',
      'Provide complete translations without省略号, 占位符, or "待翻译"',
      'Title: Example',
    ].join('\n');

    expect(sanitizeTranslationText(input, 'title')).toBe('');
    expect(hasTranslationPromptLeak(input)).toBe(true);
  });

  test('returns empty string for Chinese analysis preambles mixed into content', () => {
    const input = [
      '让我仔细分析这篇AAP的文章并准确翻译。',
      '原文标题：Emotional Development: 1 Year Olds',
      '现在翻译正文：',
      '孩子在第二年会在独立和依恋之间摇摆。',
    ].join('\n');

    expect(sanitizeTranslationText(input, 'content')).toBe('');
    expect(hasTranslationPromptLeak(input)).toBe(true);
  });

  test('returns empty string for leaked translation field labels in content', () => {
    const input = [
      '怀孕期间使用胰岛素时，应按医生建议监测血糖。',
      '译后的标题>怀孕、哺乳期间使用速效胰岛素与生育能力',
    ].join('\n');

    expect(sanitizeTranslationText(input, 'content')).toBe('');
    expect(hasTranslationPromptLeak(input)).toBe(true);
  });

  test('returns empty string for leaked structured translation tags', () => {
    const input = [
      '宝宝长牙后的母乳喂养',
      '美国儿科学会讨论了宝宝长牙后的母乳喂养问题。</summary>',
      '译后的正文：',
      '宝宝的第一颗牙齿通常会在6个月后长出。',
    ].join('\n');

    expect(sanitizeTranslationText(input, 'content')).toBe('');
    expect(hasTranslationPromptLeak(input)).toBe(true);
  });

  test('returns empty string for placeholder translation output', () => {
    expect(sanitizeTranslationText('...', 'content')).toBe('');
    expect(sanitizeTranslationText('…', 'summary')).toBe('');
    expect(isPlaceholderTranslationText('待翻译')).toBe(true);
    expect(isPlaceholderTranslationText('译后的标题')).toBe(true);
    expect(isPlaceholderTranslationText('译后的正文')).toBe(true);
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

  test('compacts long translated summaries to one or two readable sentences', () => {
    const input = '母乳喂养是保障儿童健康和生存最有效的方法之一。世界卫生组织建议出生后尽早开始母乳喂养，并在生命最初六个月进行纯母乳喂养，同时根据家庭情况获得持续支持。后续还可以在添加辅食的同时继续母乳喂养。';

    expect(compactTranslationSummary(input)).toBe('母乳喂养是保障儿童健康和生存最有效的方法之一。世界卫生组织建议出生后尽早开始母乳喂养，并在生命最初六个月进行纯母乳喂养，同时根据家庭情况获得持续支持。');
  });
});

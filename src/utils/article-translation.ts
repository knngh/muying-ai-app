export const TRANSLATION_PROMPT_LEAK_PATTERN = /<translated_(title|summary|content)>|Be accurate and faithful to the original|不要输出任何额外说明|输出必须严格使用以下标签/i;

export function stripCodeFence(input: string): string {
  const fenced = input.trim().match(/^```(?:xml|json|markdown|md|text)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() || input.trim();
}

export function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function hasTranslationPromptLeak(input: string): boolean {
  return TRANSLATION_PROMPT_LEAK_PATTERN.test(input);
}

export function sanitizeTranslationText(
  input: string,
  type: 'title' | 'summary' | 'content',
): string {
  if (!input) {
    return '';
  }

  const labelPattern = type === 'title'
    ? /^(?:[-*•·]\s*)?(?:translated_title|title|标题)\s*[:：]\s*/i
    : type === 'summary'
      ? /^(?:[-*•·]\s*)?(?:translated_summary|summary|摘要)\s*[:：]\s*/i
      : /^(?:[-*•·]\s*)?(?:translated_content|content|正文|内容)\s*[:：]\s*/i;

  let normalized = normalizeWhitespace(stripCodeFence(input))
    .replace(/<\/?translated_(title|summary|content)>/gi, '')
    .replace(/^\s*#{1,6}\s*/g, '')
    .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, '')
    .trim();

  if (hasTranslationPromptLeak(normalized)) {
    return '';
  }

  normalized = normalized
    .replace(/^(?:好的[，,]?\s*)/u, '')
    .replace(/^(?:以下(?:是|为)|下面(?:是|为)|这是)(?:本篇|这篇|当前)?(?:文章|原文|内容)?(?:的)?(?:中文)?(?:辅助)?(?:翻译|译文|中文版)?\s*[：:。.]?\s*/u, '')
    .replace(labelPattern, '')
    .trim();

  return normalized;
}

export function extractJsonObject(input: string): Record<string, unknown> | null {
  const normalized = stripCodeFence(input);
  const candidates = [
    normalized,
    (() => {
      const start = normalized.indexOf('{');
      const end = normalized.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) {
        return '';
      }
      return normalized.slice(start, end + 1);
    })(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore malformed JSON candidates
    }
  }

  return null;
}

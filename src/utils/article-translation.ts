export const TRANSLATION_PROMPT_LEAK_PATTERN = /<translated_(title|summary|content)>|<\/?(?:summary|translation)>|译后的?(?:标题|摘要|正文)\s*[>：:]|<think>|Be accurate and faithful to the original|不要输出任何额外说明|输出必须严格使用以下标签|Provide complete translations|Let me translate|do not add recommendations|do not change into diagnostic conclusions|do not omit important risk warnings|output only the translation|让我(?:仔细)?(?:分析|翻译)|现在翻译正文|原文(?:标题|摘要|正文)|摘要被截断/i;

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

export function isPlaceholderTranslationText(input: string): boolean {
  const normalized = normalizeWhitespace(input)
    .replace(/[\s\u00a0]+/g, '')
    .trim();

  return /^(?:[.。．]{2,}|…+|省略|待翻译|翻译内容|译文内容|中文译文|中文翻译|译后的?(?:标题|摘要|正文)|placeholder)$/iu.test(normalized);
}

export function sanitizeTranslationText(
  input: string | null | undefined,
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

  if (isPlaceholderTranslationText(normalized)) {
    return '';
  }

  return normalized;
}

export function compactTranslationSummary(
  input: string | null | undefined,
  fallback: string | null | undefined = '',
  maxChars = 96,
): string {
  const source = sanitizeTranslationText(input, 'summary') || sanitizeTranslationText(fallback, 'summary');
  const normalized = normalizeWhitespace(source)
    .replace(/[\t ]+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  const sentences = normalized.match(/[^。！？!?；;]+[。！？!?；;]?/gu) || [normalized];
  let compacted = '';
  for (const sentence of sentences) {
    const value = sentence.trim();
    if (!value) {
      continue;
    }

    const next = compacted ? `${compacted}${value}` : value;
    if (next.length > maxChars) {
      break;
    }

    compacted = next;
    if (compacted.length >= 42) {
      break;
    }
  }

  const result = compacted || normalized;
  if (result.length <= maxChars) {
    return result;
  }

  return `${result.slice(0, maxChars).replace(/[，、；：,.!?。！？;:]*$/u, '').trim()}...`;
}

export interface ChineseTranslationDisplayFieldInput {
  sourceTitle?: string | null;
  sourceSummary?: string | null;
  translatedTitle?: string | null;
  translatedSummary?: string | null;
  translatedContent?: string | null;
}

export interface ChineseTranslationDisplayFields {
  displayTitle: string;
  displaySummary: string;
  displayContentText: string;
}

function stripHtmlTagsForDisplay(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h[1-6]|section|article|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'');
}

function normalizeDisplayPlainText(input?: string | null): string {
  return normalizeWhitespace(stripHtmlTagsForDisplay(input || ''))
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function countPatternMatches(input: string, pattern: RegExp): number {
  const matched = input.match(pattern);
  return matched ? matched.length : 0;
}

function hasChineseText(input?: string | null): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff]/u.test(input || '');
}

function isMostlyChineseTranslationText(input?: string | null): boolean {
  const text = normalizeDisplayPlainText(input).replace(/\s+/g, '');
  if (!text) {
    return false;
  }

  const chineseChars = countPatternMatches(text, /[\u3400-\u4dbf\u4e00-\u9fff]/gu);
  const latinChars = countPatternMatches(text, /[A-Za-z]/g);
  return chineseChars >= 8 && (chineseChars >= latinChars * 0.6 || chineseChars / text.length >= 0.2);
}

function isLikelyForeignDisplayText(input?: string | null): boolean {
  const text = normalizeDisplayPlainText(input);
  if (!text || hasChineseText(text)) {
    return false;
  }

  return countPatternMatches(text, /[A-Za-z]/g) >= 4;
}

function cleanTranslatedContentForDisplay(input?: string | null): string {
  const sanitized = sanitizeTranslationText(input, 'content');
  if (!sanitized) {
    return '';
  }

  return stripHtmlTagsForDisplay(sanitized)
    .replace(/(?:译后|翻译后)?(?:的)?(?:标题|摘要|正文)[:：]/gu, '\n')
    .replace(/<\/?(?:translated_)?(?:title|summary|content)>/giu, '\n')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function isMetadataOrBylineLine(input: string): boolean {
  const line = normalizeDisplayPlainText(input);
  if (!line) {
    return true;
  }

  return /^(?:作者|关于作者|来源|参考来源|更多信息|更新日期|最后更新|责任编辑|Article Body|Last Updated|More Information|About the authors?|By\s*[:：])/iu.test(line)
    || (/(?:医学博士|博士|作者|FAAP|MD|M\.D\.|PhD|OTR|CEIM|IBCLC)/iu.test(line) && /^.{0,8}(?:作者|By|关于)/iu.test(line));
}

function normalizeChineseTitleCandidate(input?: string | null): string {
  const text = normalizeDisplayPlainText(input)
    .replace(/^(?:译后|翻译后)?(?:的)?(?:标题|摘要|正文)[:：]\s*/u, '')
    .replace(/^[-*•·]\s*/u, '')
    .trim();

  if (!hasChineseText(text)) {
    return '';
  }

  const sentence = text.match(/[^。！？!?；;\n]+[。！？!?；;]?/u)?.[0]?.trim() || text;
  return sentence.length > 34 ? `${sentence.slice(0, 34).trim()}...` : sentence;
}

function deriveChineseTitleFromTranslatedContent(content?: string | null): string {
  const text = cleanTranslatedContentForDisplay(content);
  if (!text || !isMostlyChineseTranslationText(text)) {
    return '';
  }

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const titleLine = lines.find((line) => {
    const normalized = normalizeDisplayPlainText(line);
    return hasChineseText(normalized)
      && normalized.length >= 4
      && normalized.length <= 48
      && !/[。！？!?；;]$/u.test(normalized)
      && !isMetadataOrBylineLine(normalized);
  });

  return normalizeChineseTitleCandidate(titleLine || lines.find((line) => hasChineseText(line) && !isMetadataOrBylineLine(line)) || '');
}

function deriveChineseSummaryFromTranslatedContent(content?: string | null, title?: string): string {
  const text = cleanTranslatedContentForDisplay(content);
  if (!text || !isMostlyChineseTranslationText(text)) {
    return '';
  }

  const titleText = normalizeDisplayPlainText(title);
  const lines = text
    .split(/\n+/)
    .map((line) => normalizeDisplayPlainText(line))
    .filter((line) => line && hasChineseText(line))
    .filter((line) => !isMetadataOrBylineLine(line))
    .filter((line) => !titleText || line !== titleText);
  const source = lines.find((line) => /[。！？!?；;]/u.test(line) || line.length >= 24)
    || lines[0]
    || '';

  return compactTranslationSummary(source, '', 96);
}

function shouldUseChineseContentFallback(candidate: string, translatedContent: string): boolean {
  return Boolean(translatedContent && isLikelyForeignDisplayText(candidate));
}

export function resolveChineseTranslationDisplayFields(
  input: ChineseTranslationDisplayFieldInput,
): ChineseTranslationDisplayFields {
  const displayContentText = sanitizeTranslationText(input.translatedContent, 'content');
  const chineseContent = isMostlyChineseTranslationText(displayContentText) ? displayContentText : '';
  const derivedTitle = deriveChineseTitleFromTranslatedContent(chineseContent);
  const derivedSummary = deriveChineseSummaryFromTranslatedContent(chineseContent, derivedTitle);
  const translatedTitle = sanitizeTranslationText(input.translatedTitle, 'title');
  const translatedSummary = compactTranslationSummary(input.translatedSummary, '');
  const safeTranslatedTitle = shouldUseChineseContentFallback(translatedTitle, chineseContent) ? '' : translatedTitle;
  const safeTranslatedSummary = shouldUseChineseContentFallback(translatedSummary, chineseContent) ? '' : translatedSummary;

  return {
    displayTitle: safeTranslatedTitle || derivedTitle || sanitizeTranslationText(input.sourceTitle, 'title'),
    displaySummary: safeTranslatedSummary || derivedSummary || compactTranslationSummary(input.sourceSummary, ''),
    displayContentText,
  };
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

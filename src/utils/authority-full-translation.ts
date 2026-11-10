import { normalizeWhitespace } from './article-translation';

export interface FullTranslationCoverage {
  translationCoverage?: 'full';
  translationVersion?: number;
  sourceChars?: number;
  translatedChunks?: number;
}

export function getAuthorityTranslationSource(input: string): string {
  return normalizeWhitespace(input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h[1-6]|section|article|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' '));
}

/** Every source character is assigned to a chunk; the limit bounds a request, never the article. */
export function splitAuthorityTranslationSource(source: string, maximum = 3200): string[] {
  const size = Math.max(1800, Math.floor(maximum) || 3200);
  const chunks: string[] = [];
  let remaining = source;
  while (remaining.length > size) {
    const candidate = remaining.slice(0, size);
    const boundary = Math.max(candidate.lastIndexOf('\n'), candidate.lastIndexOf('. '), candidate.lastIndexOf('? '), candidate.lastIndexOf('! '));
    const end = boundary >= size * 0.5 ? boundary + 1 : size;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining.trim()) chunks.push(remaining.trim());
  return chunks;
}

export function hasFullAuthorityTranslation(cached: FullTranslationCoverage, source: string | undefined, maximum: number): boolean {
  if (source === undefined) return true;
  const text = getAuthorityTranslationSource(source);
  if (text.length <= maximum) return true;
  return cached.translationCoverage === 'full' && cached.translationVersion === 2 && cached.sourceChars === text.length;
}

/** Reject obviously shortened segments and missing numeric facts before publishing any long translation. */
export function validateAuthorityTranslationSegment(source: string, translated: string): void {
  if (!/[\u4e00-\u9fff]/u.test(translated) || translated.length < source.length * 0.12) {
    throw new Error('分段译文过短或不是中文，未发布不完整正文');
  }
  const numbers = source.match(/\d+(?:[.,]\d+)*/g) || [];
  const translatedNumbers = new Set(translated.match(/\d+(?:[.,]\d+)*/g) || []);
  if (numbers.some(number => !translatedNumbers.has(number))) {
    throw new Error('分段译文遗漏数字，未发布不完整正文');
  }
}

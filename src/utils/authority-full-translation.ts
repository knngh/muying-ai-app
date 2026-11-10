import { normalizeWhitespace } from './article-translation';

export interface FullTranslationCoverage {
  translationCoverage?: 'full';
  translationVersion?: number;
  sourceChars?: number;
  translatedChunks?: number;
}

const MEDICAL_TERMS = [
  { source: /\bcytomegalovirus\b/i, english: 'cytomegalovirus (CMV)', chinese: '巨细胞病毒', translated: /巨细胞病毒/u, invalid: /单纯疱疹病毒\s*[（(]\s*CMV/iu },
  { source: /\bacetaminophen\b/i, english: 'acetaminophen', chinese: '对乙酰氨基酚（扑热息痛）', translated: /对乙酰氨基酚|扑热息痛/u, invalid: /乙醇酰胺/u },
  { source: /\bcircumcision\b/i, english: 'circumcision', chinese: '包皮环切术（割礼）', translated: /包皮环切|割礼/u, invalid: /环龄手术/u },
  { source: /\bvalacyclovir\b/i, english: 'valacyclovir', chinese: '伐昔洛韦', translated: /伐昔洛韦/u, invalid: /万拉西韦/u },
];

/** Source-scoped terminology prevents observed drug, virus and procedure substitutions. */
export function buildAuthorityTranslationGlossary(source: string): string {
  return MEDICAL_TERMS.filter(term => term.source.test(source))
    .map(term => `${term.english} 必须译为 ${term.chinese}。`).join('\n');
}

export function validateAuthorityTranslationTerminology(source: string, translated: string): void {
  const missing = MEDICAL_TERMS.find(term => term.source.test(source)
    && (!term.translated.test(translated) || term.invalid.test(translated)));
  if (missing) throw new Error(`译文医学术语不符：${missing.english}`);
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

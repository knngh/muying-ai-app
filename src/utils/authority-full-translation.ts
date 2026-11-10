import { normalizeWhitespace } from './article-translation';
import { decodeHtmlEntities } from '../services/authority-adapters/html-content';

export interface FullTranslationCoverage {
  translationCoverage?: 'full';
  translationVersion?: number;
  sourceChars?: number;
  translatedChunks?: number;
}

const MEDICAL_TERMS = [
  { source: /\b(?:midwife|midwives)\b/i, english: 'midwife / midwives', chinese: '助产士（助产师）', translated: /助产士|助产师/u },
  { source: /\bcytomegalovirus\b/i, english: 'cytomegalovirus (CMV)', chinese: '巨细胞病毒', translated: /巨细胞病毒/u, invalid: /单纯疱疹病毒\s*[（(]\s*CMV/iu },
  { source: /\bacetaminophen\b/i, english: 'acetaminophen', chinese: '对乙酰氨基酚（扑热息痛）', translated: /对乙酰氨基酚|扑热息痛/u, invalid: /乙醇酰胺/u },
  { source: /\bcircumcision\b/i, english: 'circumcision', chinese: '包皮环切术（割礼）', translated: /包皮环切|割礼/u, invalid: /环龄手术/u },
  { source: /\bvalacyclovir\b/i, english: 'valacyclovir', chinese: '伐昔洛韦', translated: /伐昔洛韦/u, invalid: /万拉西韦/u },
  { source: /\bgroup\s+B\s+(?:streptococcus|strep)\b/i, english: 'group B streptococcus (GBS)', chinese: 'B组链球菌（GBS）', translated: /B\s*组链球菌/iu, invalid: /乙型链球菌/u },
  { source: /\brespiratory\s+syncytial\s+virus\b/i, english: 'respiratory syncytial virus (RSV)', chinese: '呼吸道合胞病毒（RSV）', translated: /呼吸道合胞病毒/u, invalid: /呼吸同步病毒/u },
  { source: /\b(?:testis|testes|testicles)\b[^.!?]{0,120}\bdescend\s+(?:into|to)\b[^.!?]{0,80}\bscrotum\b/i, english: 'testes descend into the scrotum', chinese: '睾丸下降进入阴囊', translated: /睾丸[\s\S]{0,40}阴囊/u, invalid: /睾丸[^。！？]{0,20}从阴囊[^。！？]{0,20}下降/u },
];

/** Source-scoped terminology prevents observed drug, virus and procedure substitutions. */
export function buildAuthorityTranslationGlossary(source: string): string {
  return MEDICAL_TERMS.filter(term => term.source.test(source))
    .map(term => `${term.english} 必须译为 ${term.chinese}。`).join('\n');
}

export function validateAuthorityTranslationTerminology(source: string, translated: string): void {
  const missing = MEDICAL_TERMS.find(term => term.source.test(source)
    && (!term.translated.test(translated) || term.invalid?.test(translated)));
  if (missing) throw new Error(`译文医学术语不符：${missing.english}`);
}

function extractAuthorityTranslationSource(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h[1-6]|section|article|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ');
}

export function getAuthorityTranslationSource(input: string): string {
  return normalizeWhitespace(decodeHtmlEntities(extractAuthorityTranslationSource(input)));
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
  return cached.translationCoverage === 'full' && cached.translationVersion === 2
    && (cached.sourceChars === text.length
      || cached.sourceChars === normalizeWhitespace(extractAuthorityTranslationSource(source)).length);
}

/** Reject obviously shortened segments and missing numeric facts before publishing any long translation. */
export function validateAuthorityTranslationSegment(source: string, translated: string): void {
  const chinese = (translated.match(/[\u4e00-\u9fff]/gu) || []).length;
  const latin = (translated.match(/[a-z]/giu) || []).length;
  if (!chinese || chinese < latin * 0.3 || translated.length < source.length * 0.12) {
    throw new Error('分段译文过短或不是中文，未发布不完整正文');
  }
  const numbers = source.match(/\d+(?:[.,]\d+)*/g) || [];
  const normalizeNumber = (number: string) => /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/u.test(number)
    ? number.replace(/,/g, '') : number;
  const translatedNumbers = new Set((translated.match(/\d+(?:[.,]\d+)*/g) || []).map(normalizeNumber));
  const missing = [...new Set(numbers.filter(number => !translatedNumbers.has(normalizeNumber(number))))];
  if (missing.length) {
    throw new Error(`分段译文遗漏数字，未发布不完整正文（缺失：${missing.slice(0, 24).join('、')}）`);
  }
}

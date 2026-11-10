import { decodeHtmlEntities } from '../services/authority-adapters/html-content';

/**
 * A layout-only result is allowed to classify source text, but never to edit it.
 * Keep these limits deliberately conservative because the result comes from an
 * external model and may later be rendered in the browser.
 */
export const KNOWLEDGE_LAYOUT_BLOCK_TYPES = ['title', 'heading', 'paragraph', 'list', 'table', 'chrome'] as const;
export type KnowledgeLayoutBlockType = typeof KNOWLEDGE_LAYOUT_BLOCK_TYPES[number];

export type KnowledgeLayoutBlock = {
  type: KnowledgeLayoutBlockType;
  text: string;
};

/** Prose-only layouts cannot faithfully carry existing media, links or tables. */
export function getKnowledgeLayoutSourceText(content: string): string | null {
  if (/<(?:table|img|a|video|audio|iframe)\b/i.test(content)) return null;
  return decodeHtmlEntities(content
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?>|<\/(?:p|div|h[1-6]|li|section|article)>/gi, '\n')
    .replace(/<(?:[^"'<>]|"[^"]*"|'[^']*')*>/g, '')
  ).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ')
    .replace(/([。！？；][”’」』）】]*)[ \t]*(?=\S)/gu, '$1\n')
    .replace(/\n{2,}/g, '\n').trim();
}

export type VerifiedKnowledgeLayout = {
  verified: true;
  blocks: KnowledgeLayoutBlock[];
};

const MAX_SOURCE_LENGTH = 200_000;
const MAX_BLOCKS = 500;
const MAX_BLOCK_TEXT_LENGTH = 20_000;

export class KnowledgeLayoutValidationError extends Error {
  readonly code = 'KNOWLEDGE_LAYOUT_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeLayoutValidationError';
  }
}

function invalid(message: string): never {
  throw new KnowledgeLayoutValidationError(message);
}

/**
 * Whitespace is the only difference that a layout model may introduce. This
 * makes line wrapping and JSON escaping harmless while preserving every word,
 * number, unit, date, and punctuation mark.
 */
export function normalizeKnowledgeLayoutText(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJsonObject(output: string): unknown {
  const trimmed = output.trim();
  if (!trimmed) {
    invalid('排版模型返回为空，JSON 结构无法验证原文');
  }

  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim();

  try {
    return JSON.parse(withoutFence) as unknown;
  } catch {
    invalid('排版模型返回的 JSON 结构无效');
  }
}

function isKnowledgeLayoutBlockType(value: unknown): value is KnowledgeLayoutBlockType {
  return typeof value === 'string'
    && (KNOWLEDGE_LAYOUT_BLOCK_TYPES as readonly string[]).includes(value);
}

export function getKnowledgeLayoutSourceLines(sourceText: string): string[] {
  return sourceText.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
}

/** The model names paragraph ranges; it never supplies the text we render. */
export function parseKnowledgeLayoutAnnotations(output: string, sourceText: string): VerifiedKnowledgeLayout {
  const parsed = parseJsonObject(output) as { blocks?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.blocks) || !parsed.blocks.length || parsed.blocks.length > MAX_BLOCKS) {
    invalid('排版标注缺少有效分块');
  }
  const lines = getKnowledgeLayoutSourceLines(sourceText);
  let nextLine = 0;
  const blocks = parsed.blocks.map((entry: unknown): KnowledgeLayoutBlock => {
    if (!entry || typeof entry !== 'object') invalid('排版标注结构无效');
    const { type, from, to, text } = entry as { type?: unknown; from?: unknown; to?: unknown; text?: unknown };
    if (!isKnowledgeLayoutBlockType(type) || !Number.isInteger(from) || !Number.isInteger(to)
      || typeof from !== 'number' || typeof to !== 'number' || from !== nextLine
      || to < from || to >= lines.length || text !== undefined) invalid('排版标注未连续完整覆盖原文');
    nextLine = to + 1;
    return { type, text: lines.slice(from, to + 1).join('\n') };
  });
  if (nextLine !== lines.length) invalid('排版标注遗漏原文段落');
  return parseKnowledgeLayoutOutput(JSON.stringify({ blocks }), sourceText);
}

/**
 * Parse and verify a model response. The concatenated block text must equal the
 * source after whitespace normalization; otherwise callers must use the local
 * formatter and discard the model result.
 */
export function parseKnowledgeLayoutOutput(
  output: string,
  sourceText: string,
): VerifiedKnowledgeLayout {
  if (typeof output !== 'string') {
    invalid('排版模型返回类型无效');
  }
  if (typeof sourceText !== 'string' || !sourceText.trim()) {
    invalid('原文为空，无法生成排版标注');
  }
  if (sourceText.length > MAX_SOURCE_LENGTH) {
    invalid(`原文长度超过排版校验上限（${MAX_SOURCE_LENGTH}）`);
  }

  const parsed = parseJsonObject(output);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    invalid('排版模型返回必须是包含 blocks 的 JSON 对象');
  }

  const blocksValue = (parsed as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocksValue) || blocksValue.length === 0) {
    invalid('排版模型未返回有效 blocks 分块');
  }
  if (blocksValue.length > MAX_BLOCKS) {
    invalid(`排版分块数量超过上限（${MAX_BLOCKS}）`);
  }

  const blocks = blocksValue.map((candidate, index): KnowledgeLayoutBlock => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      invalid(`第 ${index + 1} 个排版分块结构无效`);
    }

    const type = (candidate as { type?: unknown }).type;
    const text = (candidate as { text?: unknown }).text;
    if (!isKnowledgeLayoutBlockType(type)) {
      invalid(`第 ${index + 1} 个排版分块类型无效`);
    }
    if (typeof text !== 'string' || !text.trim()) {
      invalid(`第 ${index + 1} 个排版分块文本为空`);
    }
    if (text.length > MAX_BLOCK_TEXT_LENGTH) {
      invalid(`第 ${index + 1} 个排版分块长度超过上限（${MAX_BLOCK_TEXT_LENGTH}）`);
    }

    return {
      type: (type === 'heading' || type === 'title')
        && (text.trim().length > 80 || /[\n。！；;]/u.test(text.trim())) ? 'paragraph' : type,
      text: text.trim(),
    };
  });

  const source = normalizeKnowledgeLayoutText(sourceText);
  const rendered = normalizeKnowledgeLayoutText(blocks.map((block) => block.text).join('\n'));
  if (!source || source !== rendered) {
    invalid('排版分块未按原文顺序完整保留原文，已拒绝模型结果');
  }

  return {
    verified: true,
    blocks,
  };
}

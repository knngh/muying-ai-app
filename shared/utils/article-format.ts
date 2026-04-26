function normalizeBlock(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const JUSTIFIED_TEXT_STYLE = 'text-align:justify;text-justify:inter-ideograph;text-align-last:left;word-break:break-word;overflow-wrap:anywhere;';
const PARAGRAPH_INLINE_STYLE = `margin:0 0 1.1em;line-height:1.9;${JUSTIFIED_TEXT_STYLE}`;

export type ArticleOutlineItem = {
  id: string;
  title: string;
  level: 1 | 2 | 3;
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtmlTags(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h[1-6]|section|article|div)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');
}

function appendInlineStyle(attrs: string | undefined, inlineStyle: string): string {
  const normalizedAttrs = attrs || '';
  const styleMatch = normalizedAttrs.match(/\sstyle=(['"])(.*?)\1/i);

  if (!styleMatch) {
    return `${normalizedAttrs} style="${inlineStyle}"`;
  }

  const quote = styleMatch[1];
  const existing = styleMatch[2]?.trim() || '';
  const merged = existing.endsWith(';') ? `${existing}${inlineStyle}` : `${existing};${inlineStyle}`;
  return normalizedAttrs.replace(/\sstyle=(['"])(.*?)\1/i, ` style=${quote}${merged}${quote}`);
}

function stripProblematicInlineStyles(html: string): string {
  return html.replace(/\sstyle=(['"])(.*?)\1/gi, (_match, quote: string, rawStyle: string) => {
    const cleaned = rawStyle
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => !/^(?:margin(?:-(?:top|right|bottom|left))?|padding(?:-(?:top|right|bottom|left))?|height|min-height|max-height)\s*:/i.test(item))
      .join(';');

    return cleaned ? ` style=${quote}${cleaned}${quote}` : '';
  });
}

function wrapHtmlTables(html: string): string {
  return html.replace(/<table\b[\s\S]*?<\/table>/gi, (tableHtml) => {
    if (/article-table-wrap/.test(tableHtml)) {
      return tableHtml;
    }

    return [
      '<div',
      ' class="article-table-wrap"',
      ' style="width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;',
      '-webkit-overflow-scrolling:touch;margin:0 0 1.1em;padding-bottom:4px;',
      'border:1px solid rgba(184,138,72,0.12);border-radius:16px;background:#fffdf9;"',
      '>',
      tableHtml,
      '</div>',
    ].join('');
  });
}

function addBlockSpacingToHtml(html: string): string {
  const blockStyles: Array<{ tag: string; style: string }> = [
    { tag: 'p', style: `margin:0 0 1.1em;line-height:1.9;display:block;${JUSTIFIED_TEXT_STYLE}` },
    { tag: 'div', style: `margin:0 0 1.1em;line-height:1.9;display:block;${JUSTIFIED_TEXT_STYLE}` },
    { tag: 'section', style: `margin:0 0 1.1em;line-height:1.9;display:block;${JUSTIFIED_TEXT_STYLE}` },
    { tag: 'article', style: `margin:0 0 1.1em;line-height:1.9;display:block;${JUSTIFIED_TEXT_STYLE}` },
    { tag: 'li', style: `margin:0 0 0.7em;line-height:1.9;${JUSTIFIED_TEXT_STYLE}` },
    { tag: 'ul', style: 'margin:0 0 1em 1.2em;padding:0;' },
    { tag: 'ol', style: 'margin:0 0 1em 1.2em;padding:0;' },
    { tag: 'h1', style: 'margin:0 0 0.9em;line-height:1.5;font-weight:700;text-align:left;' },
    { tag: 'h2', style: 'margin:0 0 0.9em;line-height:1.55;font-weight:700;text-align:left;' },
    { tag: 'h3', style: 'margin:0 0 0.8em;line-height:1.6;font-weight:700;text-align:left;' },
    { tag: 'blockquote', style: `margin:0 0 1em;padding:0.2em 0 0.2em 0.9em;border-left:4px solid #f4c7d7;color:#6b7785;${JUSTIFIED_TEXT_STYLE}` },
    { tag: 'img', style: 'display:block;max-width:100%;height:auto;border-radius:16px;margin:0 0 1em;' },
    { tag: 'table', style: 'width:max-content;min-width:100%;max-width:none;border-collapse:collapse;background:#fff7f1;font-size:13px;line-height:1.6;' },
    { tag: 'th', style: 'min-width:96px;border:1px solid rgba(184,138,72,0.18);padding:10px 12px;vertical-align:top;text-align:left;background:#f8ebdd;color:#35261e;font-weight:700;white-space:normal;' },
    { tag: 'td', style: 'min-width:96px;border:1px solid rgba(184,138,72,0.18);padding:10px 12px;vertical-align:top;text-align:left;white-space:normal;' },
    { tag: 'figcaption', style: 'margin:-0.3em 0 1em;font-size:0.92em;line-height:1.7;color:#7d6c61;text-align:left;' },
  ];

  return blockStyles.reduce((result, item) => (
    result.replace(new RegExp(`<${item.tag}(\\s[^>]*)?>`, 'gi'), (_match, attrs?: string) => (
      `<${item.tag}${appendInlineStyle(attrs, item.style)}>`
    ))
  ), html);
}

function toOutlineText(input: string): string {
  return stripHtmlTags(input).replace(/\s+/g, ' ').trim();
}

function buildHeadingId(index: number): string {
  return `article-section-${index + 1}`;
}

export function extractArticleOutline(content: string): ArticleOutlineItem[] {
  const trimmed = content.trim();
  if (!trimmed || !/<h[1-3]\b/i.test(trimmed)) {
    return [];
  }

  return Array.from(trimmed.matchAll(/<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi))
    .map((match, index) => {
      const level = Number(match[1]) as 1 | 2 | 3;
      const title = toOutlineText(match[3] || '');
      if (!title) {
        return null;
      }

      return {
        id: buildHeadingId(index),
        title,
        level,
      } satisfies ArticleOutlineItem;
    })
    .filter((item): item is ArticleOutlineItem => Boolean(item));
}

export function addArticleHeadingAnchors(content: string): string {
  const trimmed = content.trim();
  if (!trimmed || !/<h[1-3]\b/i.test(trimmed)) {
    return content;
  }

  let headingIndex = 0;
  return trimmed.replace(/<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_match, level: string, attrs: string, inner: string) => {
    const title = toOutlineText(inner);
    if (!title) {
      return `<h${level}${attrs}>${inner}</h${level}>`;
    }

    const id = buildHeadingId(headingIndex);
    headingIndex += 1;
    const attrsWithId = /\sid=(['"]).*?\1/i.test(attrs)
      ? attrs.replace(/\sid=(['"]).*?\1/i, ` id="${id}"`)
      : `${attrs} id="${id}"`;

    return `<h${level}${attrsWithId}>${inner}</h${level}>`;
  });
}

function isLikelyHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.length <= 24 && !/[。！？!?；;]$/.test(trimmed)) {
    return /^(第[一二三四五六七八九十百千万0-9]+[章节部分篇条]|[一二三四五六七八九十]+[、.．]|[0-9]+[、.．]|（[一二三四五六七八九十0-9]+）|附件|附：|提示|建议|结论|原因|措施|何时就医|不确定性说明|参考来源)/u.test(trimmed);
  }

  return false;
}

function splitHeadingPrefix(line: string): { heading?: string; remainder?: string } {
  const trimmed = line.trim();
  const match = trimmed.match(/^(第[一二三四五六七八九十百千万0-9]+[章节部分篇条]|[一二三四五六七八九十]+[、.．]|[0-9]+[、.．]|（[一二三四五六七八九十0-9]+）|附件|附：|提示|建议|结论|原因|措施|何时就医|不确定性说明|参考来源)(.*)$/u);
  if (!match) {
    return {};
  }

  const heading = match[1]?.trim();
  const remainder = match[2]?.trim();
  if (!heading) {
    return {};
  }

  if (!remainder) {
    return { heading };
  }

  const headingTextMatch = remainder.match(/^([\u4e00-\u9fa5A-Za-z0-9]{2,12}?)(?=(如果|请|应|需|可|先|要|做|保持|观察|出现|及时|立即|继续|尽快|按照|根据|对于|将|建议|注意))/u);
  if (headingTextMatch?.[1]) {
    const headingText = headingTextMatch[1].trim();
    return {
      heading: `${heading}${headingText}`,
      remainder: remainder.slice(headingText.length).trim(),
    };
  }

  if (remainder.length <= 12 && !/[。！？!?；;]$/.test(remainder)) {
    return { heading: `${heading}${remainder}` };
  }

  return { heading: `${heading}${remainder.replace(/[。！？!?；;].*$/u, '').trim()}`.trim(), remainder };
}

function splitIntoSentences(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const matched = normalized.match(/[^。！？!?；;]+[。！？!?；;]?/gu);
  if (!matched) {
    return [normalized];
  }

  return matched.map((item) => item.trim()).filter(Boolean);
}

function chunkSentences(sentences: string[], maxChars = 88, maxSentences = 2): string[] {
  const chunks: string[] = [];
  let current = '';
  let currentCount = 0;

  for (const sentence of sentences) {
    const candidate = `${current}${sentence}`.trim();
    if (current && (candidate.length > maxChars || currentCount >= maxSentences)) {
      chunks.push(current.trim());
      current = sentence;
      currentCount = 1;
      continue;
    }

    current = candidate;
    currentCount += 1;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

function expandDenseParagraph(paragraph: string): string[] {
  const trimmed = paragraph.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.length <= 80 && splitIntoSentences(trimmed).length <= 2) {
    return [trimmed];
  }

  const sentences = splitIntoSentences(trimmed);
  if (sentences.length <= 2) {
    return [trimmed];
  }

  return chunkSentences(sentences);
}

export function segmentArticleText(text: string): string[] {
  const normalized = normalizeBlock(
    text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/([。！？!?；;])(?=(第[一二三四五六七八九十百千万0-9]+[章节部分篇条]|[一二三四五六七八九十]+[、.．]|[0-9]+[、.．]|（[一二三四五六七八九十0-9]+）|附件|附：|提示|建议|结论|原因|措施|何时就医|不确定性说明|参考来源))/gu, '$1\n')
      .replace(/(?<!\n)(第[一二三四五六七八九十百千万0-9]+[章节部分篇条])/gu, '\n$1')
      .replace(/(?<!\n)([一二三四五六七八九十]+[、.．])/gu, '\n$1')
      .replace(/(?<!\n)(（[一二三四五六七八九十0-9]+）)/gu, '\n$1'),
  );

  if (!normalized) {
    return [];
  }

  const rawBlocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const result: string[] = [];

  for (const rawBlock of rawBlocks) {
    const lines = rawBlock
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    let buffer = '';
    for (const line of lines) {
      const splitHeading = splitHeadingPrefix(line);
      if (splitHeading.heading) {
        if (buffer.trim()) {
          result.push(...expandDenseParagraph(buffer));
          buffer = '';
        }

        result.push(splitHeading.heading);
        if (splitHeading.remainder) {
          buffer = splitHeading.remainder;
        }
        continue;
      }

      if (/^[-*•·]\s+/.test(line) || isLikelyHeading(line)) {
        if (buffer.trim()) {
          result.push(...expandDenseParagraph(buffer));
          buffer = '';
        }
        result.push(line);
        continue;
      }

      buffer = buffer ? `${buffer} ${line}` : line;
    }

    if (buffer.trim()) {
      result.push(...expandDenseParagraph(buffer));
    }
  }

  return result.filter(Boolean);
}

export function textToRichParagraphHtml(text: string): string {
  return segmentArticleText(text)
    .map((paragraph) => {
      if (/^[-*•·]\s+/.test(paragraph)) {
        return `<p style="${PARAGRAPH_INLINE_STYLE}">${escapeHtml(paragraph.replace(/^[-*•·]\s+/, ''))}</p>`;
      }

      return `<p style="${PARAGRAPH_INLINE_STYLE}">${escapeHtml(paragraph)}</p>`;
    })
    .join('');
}

export function formatRichArticleContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return '';
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    const sanitizedHtml = trimmed
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<(?:nav|footer|header|aside)[\s\S]*?<\/(?:nav|footer|header|aside)>/gi, '')
      .replace(/<(?:p|div|section|article|blockquote)[^>]*>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/(?:p|div|section|article|blockquote)>/gi, '')
      .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>')
      .replace(/\sclass=(['"])[^'"]*\1/gi, '')
      .replace(/\sid=(['"])[^'"]*\1/gi, '')
      .replace(/\sdata-[\w-]+=(['"])[^'"]*\1/gi, '')
      .replace(/\saria-[\w-]+=(['"])[^'"]*\1/gi, '')
      .replace(/\srole=(['"])[^'"]*\1/gi, '')
      .replace(/\s(?:width|height|cellpadding|cellspacing|valign|align)=(['"])[^'"]*\1/gi, '')
      .replace(/\s(?:width|height|cellpadding|cellspacing|valign|align)=([^\s>]+)/gi, '')
      .replace(/&nbsp;/gi, ' ')
      .trim();

    const normalizedHtml = wrapHtmlTables(stripProblematicInlineStyles(sanitizedHtml)).trim();

    if (/<(?:p|div|section|article|li|ul|ol|h[1-6]|blockquote|table|img|figure|figcaption|thead|tbody|tr|td|th)\b/i.test(normalizedHtml)) {
      return addBlockSpacingToHtml(normalizedHtml);
    }

    return textToRichParagraphHtml(stripHtmlTags(normalizedHtml));
  }

  return textToRichParagraphHtml(trimmed);
}

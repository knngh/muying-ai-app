function normalizeBlock(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

function chunkSentences(sentences: string[], maxChars = 120, maxSentences = 2): string[] {
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
        return `<p>${paragraph
          .replace(/^[-*•·]\s+/, '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')}</p>`;
      }

      return `<p>${paragraph
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')}</p>`;
    })
    .join('');
}

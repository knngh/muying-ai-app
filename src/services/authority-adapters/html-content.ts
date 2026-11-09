/** Narrow HTML reader for official article containers; never executes source markup. */
export function readHtmlAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  }
  return attributes;
}

export function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', hellip: '…' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (!code.startsWith('#')) return named[code.toLowerCase()] ?? entity;
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point) : entity;
  });
}

export interface HtmlContainerSelector {
  tag: 'div' | 'article' | 'main';
  id?: RegExp;
  className?: RegExp;
}

/** Balance same-name tags so a nested div cannot truncate the remaining article. */
export function extractHtmlContainers(rawBody: string, selectors: HtmlContainerSelector[]): string[] {
  const html = rawBody.replace(/<!--[\s\S]*?-->|<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const stacks = new Map<string, Array<{ start: number; selector: number }>>();
  const candidates: Array<{ html: string; selector: number; start: number }> = [];
  const tags = /<\/?(div|article|main)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
  for (const match of html.matchAll(tags)) {
    const tag = match[1].toLowerCase();
    const stack = stacks.get(tag) ?? [];
    stacks.set(tag, stack);
    if (match[0].startsWith('</')) {
      const open = stack.pop();
      if (open && open.selector >= 0) candidates.push({ html: html.slice(open.start, match.index), selector: open.selector, start: open.start });
    } else if (!match[0].endsWith('/>')) {
      const attrs = readHtmlAttributes(match[0]);
      const selector = selectors.findIndex(item => item.tag === tag
        && (!item.id || item.id.test(attrs.id || ''))
        && (!item.className || item.className.test(attrs.class || '')));
      stack.push({ start: match.index + match[0].length, selector });
    }
  }
  return candidates.sort((a, b) => a.selector - b.selector || a.start - b.start).map(item => item.html);
}

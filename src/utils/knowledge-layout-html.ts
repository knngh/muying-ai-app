import type { KnowledgeLayoutBlock } from './knowledge-layout';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
}

/** The model supplies plain text classifications, never HTML or CSS. */
export function renderKnowledgeLayoutBlocksToHtml(blocks: KnowledgeLayoutBlock[]): string {
  return blocks.map(block => {
    const text = escapeHtml(block.text);
    if (block.type === 'title' || block.type === 'heading') return `<h2>${text}</h2>`;
    if (block.type === 'table') return `<div class="reading-lines">${text}</div>`;
    if (block.type === 'list') {
      // Keep original markers in the DOM: source text remains auditable and a
      // numbered dose or schedule can never be mistaken for a disposable bullet.
      const lines = block.text.split(/\r?\n+/).filter(line => line.trim());
      const marker = /^\s*(?:[-•●▪*]|o\s|\d+[.)、])/u;
      const marked = lines.some(line => marker.test(line));
      const items: string[] = [];
      for (const line of lines) {
        if (!marked || marker.test(line) || !items.length) items.push(line);
        else items[items.length - 1] += ` ${line}`;
      }
      return `<ul${marked ? ' class="reading-list-marked" style="list-style:none;padding-left:0;"' : ''}>${items.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
    }
    // The shared webpage formatter removes aside elements. A model label must
    // never make source text disappear from the final article.
    if (block.type === 'chrome') return `<p>${text}</p>`;
    if (block.type === 'paragraph') return `<p>${escapeHtml(block.text.replace(/\s*\n\s*/g, ' '))}</p>`;
    return `<p>${text}</p>`;
  }).join('');
}

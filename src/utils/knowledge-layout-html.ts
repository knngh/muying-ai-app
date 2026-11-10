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
    if (block.type === 'list' || block.type === 'table') return `<div class="reading-lines">${text}</div>`;
    // The shared webpage formatter removes aside elements. A model label must
    // never make source text disappear from the final article.
    if (block.type === 'chrome') return `<p>${text}</p>`;
    if (block.type === 'paragraph') return block.text.split(/\r?\n+/).filter(line => line.trim())
      .map(line => `<p>${escapeHtml(line)}</p>`).join('');
    return `<p>${text}</p>`;
  }).join('');
}

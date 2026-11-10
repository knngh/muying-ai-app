import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const source = '喂养原则\n孩子满6月龄后添加辅食。\n每日观察宝宝状态。';
const blocks = [{ type: 'heading', text: '喂养原则' }, { type: 'paragraph', text: '孩子满6月龄后添加辅食。' }, { type: 'paragraph', text: '每日观察宝宝状态。' }];

describe('verified knowledge reading layout', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beihu-layout-'));
    process.env.KNOWLEDGE_LAYOUT_CACHE_PATH = path.join(dir, 'cache.json');
    process.env.KNOWLEDGE_AI_LAYOUT_ENABLED = 'true';
    jest.resetModules();
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.KNOWLEDGE_LAYOUT_CACHE_PATH;
    delete process.env.KNOWLEDGE_AI_LAYOUT_ENABLED;
  });
  it('rejects changed medical numbers, omitted lines, reordered text and invented headings', () => {
    const { parseKnowledgeLayoutOutput } = require('../src/utils/knowledge-layout');
    expect(parseKnowledgeLayoutOutput(JSON.stringify({ blocks }), source).verified).toBe(true);
    for (const altered of [blocks.slice(0, 2), [...blocks].reverse(), blocks.map(b => ({ ...b, text: b.text.replace('6月龄', '4月龄') })), [{ type: 'heading', text: '医生建议' }, ...blocks]]) {
      expect(() => parseKnowledgeLayoutOutput(JSON.stringify({ blocks: altered }), source)).toThrow();
    }
  });
  it('uses matching cached layout only; changed source, malformed cache or disabled feature falls back', () => {
    const { buildKnowledgeLayoutSourceFingerprint, saveKnowledgeLayoutCache, getCachedKnowledgeReadingLayout } = require('../src/services/knowledge-layout.service');
    saveKnowledgeLayoutCache({ sample: { slug: 'sample', sourceFingerprint: buildKnowledgeLayoutSourceFingerprint(source), blocks, updatedAt: new Date().toISOString() } });
    expect(getCachedKnowledgeReadingLayout('sample', source)?.html).toContain('<h2>喂养原则</h2>');
    expect(getCachedKnowledgeReadingLayout('sample', source.replace('6月龄', '8月龄'))).toBeNull();
    process.env.KNOWLEDGE_AI_LAYOUT_ENABLED = 'false';
    expect(getCachedKnowledgeReadingLayout('sample', source)).toBeNull();
    process.env.KNOWLEDGE_AI_LAYOUT_ENABLED = 'true';
    saveKnowledgeLayoutCache({ sample: { slug: 'sample', sourceFingerprint: buildKnowledgeLayoutSourceFingerprint(source), blocks: blocks.slice(0, 1), updatedAt: new Date().toISOString() } });
    expect(getCachedKnowledgeReadingLayout('sample', source)).toBeNull();
  });
  it('extracts rendered prose consistently and preserves structured tables, images and links', () => {
    const { getKnowledgeLayoutSourceText } = require('../src/utils/knowledge-layout');
    expect(getKnowledgeLayoutSourceText('<p>喂养原则</p><p>孩子满6月龄后添加辅食。</p><p>每日观察宝宝状态。</p>')).toBe(source);
    for (const html of ['<table><tr><td>4 mg</td></tr></table>', '<p>正文</p><img src="https://example.org/a.png">', '<p><a href="https://example.org">资料链接</a></p>']) {
      expect(getKnowledgeLayoutSourceText(html)).toBeNull();
    }
  });
  it('separates inline FAQ questions from answers before asking the model to mark their structure', () => {
    const { getKnowledgeLayoutSourceText } = require('../src/utils/knowledge-layout');
    expect(getKnowledgeLayoutSourceText('<p>可以接种吗？请咨询医生。下一次何时接种？按医嘱安排。</p>'))
      .toBe('可以接种吗？\n请咨询医生。\n下一次何时接种？\n按医嘱安排。');
  });
  it('keeps long or multi-sentence model headings as ordinary paragraphs with every fact intact', () => {
    const { parseKnowledgeLayoutOutput } = require('../src/utils/knowledge-layout');
    const { renderKnowledgeLayoutBlocksToHtml } = require('../src/utils/knowledge-layout-html');
    for (const text of ['在美国，疫苗只有在全面研究后才获批准。测试包括不同人群。', '制造疫苗的方法包括' + '减弱或灭活病原体以及使用病原体的部分成分、'.repeat(6)]) {
      const verified = parseKnowledgeLayoutOutput(JSON.stringify({ blocks: [{ type: 'heading', text }] }), text);
      expect(renderKnowledgeLayoutBlocksToHtml(verified.blocks)).toBe(`<p>${text}</p>`);
    }
  });
  it('renders model text as escaped text and retains chrome instead of silently deleting it', () => {
    const { renderKnowledgeLayoutBlocksToHtml } = require('../src/utils/knowledge-layout-html');
    const html = renderKnowledgeLayoutBlocksToHtml([{ type: 'paragraph', text: '<img src=x onerror=alert(1)>' }, { type: 'chrome', text: '来源说明' }]);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('来源说明');
    const paragraphs = renderKnowledgeLayoutBlocksToHtml([{ type: 'paragraph', text: '第一段原文。\n第二段原文。' }]);
    expect(paragraphs).toBe('<p>第一段原文。 第二段原文。</p>');
  });
  it('preserves medical prose even when the model calls it chrome and the webpage sanitizes the HTML', () => {
    const { renderKnowledgeLayoutBlocksToHtml } = require('../src/utils/knowledge-layout-html');
    const { formatRichArticleContent } = require('../shared/utils/article-format');
    const fact = '疫苗能训练免疫系统攻击特定的病毒和细菌。';
    const html = renderKnowledgeLayoutBlocksToHtml([{ type: 'chrome', text: fact }, { type: 'paragraph', text: '孕期接种前请咨询医生。' }]);
    expect(formatRichArticleContent(html)).toContain(fact);
  });
  it('rejects unverifiable provider output without saving it', async () => {
    const { formatKnowledgeLayoutWithAI } = require('../src/services/knowledge-layout.service');
    const invokeModel = jest.fn().mockResolvedValue({ answer: JSON.stringify({ blocks: [{ type: 'paragraph', text: '4月龄开始辅食' }] }), route: { provider: 'freellm', model: 'auto', route: 'task', label: 'layout' } });
    expect((await formatKnowledgeLayoutWithAI(source, { invokeModel })).verified).toBe(false);
    expect(fs.existsSync(process.env.KNOWLEDGE_LAYOUT_CACHE_PATH!)).toBe(false);
  });
  it('formats long articles in bounded sections and verifies the entire combined original', async () => {
    const { formatKnowledgeLayoutWithAI } = require('../src/services/knowledge-layout.service');
    const longSource = Array.from({ length: 75 }, (_, i) => `第${i + 1}条原文，请完整保留。`).join('\n');
    const invokeModel = jest.fn().mockImplementation(async (_role, messages) => {
      const { paragraphs } = JSON.parse(messages[1].content);
      expect(paragraphs.length).toBeLessThanOrEqual(32);
      return { answer: JSON.stringify({ blocks: [{ type: 'paragraph', from: 0, to: paragraphs.length - 1 }] }),
        route: { provider: 'freellm', model: 'auto', route: 'task', label: 'layout' } };
    });
    const result = await formatKnowledgeLayoutWithAI(longSource, { invokeModel });
    expect(result.verified).toBe(true);
    expect(result.blocks.map(block => block.text).join('\n')).toBe(longSource);
  });
  it('discards all sections if a later layout section is incomplete', async () => {
    const { formatKnowledgeLayoutWithAI } = require('../src/services/knowledge-layout.service');
    const longSource = Array.from({ length: 40 }, (_, i) => `第${i + 1}条原文。`).join('\n');
    const invokeModel = jest.fn().mockResolvedValueOnce({ answer: '{"blocks":[{"type":"paragraph","from":0,"to":31}]}', route: { provider: 'freellm', model: 'auto', route: 'task', label: 'layout' } })
      .mockResolvedValue({ answer: '{"blocks":[{"type":"paragraph","from":0,"to":0}]}', route: { provider: 'freellm', model: 'auto', route: 'task', label: 'layout' } });
    const result = await formatKnowledgeLayoutWithAI(longSource, { invokeModel });
    expect(result).toEqual({ verified: false, blocks: [], reason: 'validation_failed' });
  });

  it('retries incomplete annotations and preserves all medical facts in semantic lists', async () => {
    const { formatKnowledgeLayoutWithAI } = require('../src/services/knowledge-layout.service');
    const { renderKnowledgeLayoutBlocksToHtml } = require('../src/utils/knowledge-layout-html');
    const input = '接种前\n• 告知医生您曾出现的过敏反应。\n• 不要自行停用处方药。';
    const invokeModel = jest.fn().mockResolvedValueOnce({ answer: '{"blocks":[{"type":"heading","from":0,"to":0}]}', route: { provider: 'freellm', model: 'auto', route: 'task', label: 'layout' } })
      .mockResolvedValueOnce({ answer: '{"blocks":[{"type":"heading","from":0,"to":0},{"type":"list","from":1,"to":2}]}', route: { provider: 'freellm', model: 'auto', route: 'task', label: 'layout' } });
    const result = await formatKnowledgeLayoutWithAI(input, { invokeModel });
    expect(result.verified).toBe(true);
    expect(invokeModel).toHaveBeenCalledTimes(2);
    const html = renderKnowledgeLayoutBlocksToHtml(result.blocks);
    expect(html).toContain('<ul');
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toContain('不要自行停用处方药。');
  });

  it('splits inline bullet markers without splitting decimals or inventing words', () => {
    const { getKnowledgeLayoutSourceText } = require('../src/utils/knowledge-layout');
    expect(getKnowledgeLayoutSourceText('注意事项： • 1.5 mg药物。 • 不要自行停药。'))
      .toBe('注意事项：\n• 1.5 mg药物。\n• 不要自行停药。');
  });
});

describe('layout annotations reference original paragraphs', () => {
  it('reconstructs original text from a complete, ordered paragraph range', () => {
    const { parseKnowledgeLayoutAnnotations } = require('../src/utils/knowledge-layout');
    const result = parseKnowledgeLayoutAnnotations('{"blocks":[{"type":"heading","from":0,"to":0},{"type":"paragraph","from":1,"to":2}]}', source);
    expect(result.blocks).toEqual([{ type: 'heading', text: '喂养原则' }, { type: 'paragraph', text: '孩子满6月龄后添加辅食。\n每日观察宝宝状态。' }]);
    for (const ranges of [
      [{ type: 'heading', from: 0, to: 0 }],
      [{ type: 'paragraph', from: 1, to: 2 }],
      [{ type: 'paragraph', from: 0, to: 1 }, { type: 'paragraph', from: 1, to: 2 }],
      [{ type: 'paragraph', from: 0, to: 3 }],
      [{ type: 'paragraph', from: 0.5, to: 2 }],
      [{ type: 'heading', from: 0, to: 2, text: '改写后的建议' }],
    ]) expect(() => parseKnowledgeLayoutAnnotations(JSON.stringify({ blocks: ranges }), source)).toThrow();
  });
});

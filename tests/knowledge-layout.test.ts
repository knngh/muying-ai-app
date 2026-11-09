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
  it('renders model text as escaped text and retains chrome instead of silently deleting it', () => {
    const { renderKnowledgeLayoutBlocksToHtml } = require('../src/utils/knowledge-layout-html');
    const html = renderKnowledgeLayoutBlocksToHtml([{ type: 'paragraph', text: '<img src=x onerror=alert(1)>' }, { type: 'chrome', text: '来源说明' }]);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('来源说明');
  });
  it('rejects unverifiable provider output without saving it', async () => {
    const { formatKnowledgeLayoutWithAI } = require('../src/services/knowledge-layout.service');
    const invokeModel = jest.fn().mockResolvedValue({ answer: JSON.stringify({ blocks: [{ type: 'paragraph', text: '4月龄开始辅食' }] }), route: { provider: 'freellm', model: 'auto', route: 'task', label: 'layout' } });
    expect((await formatKnowledgeLayoutWithAI(source, { invokeModel })).verified).toBe(false);
    expect(fs.existsSync(process.env.KNOWLEDGE_LAYOUT_CACHE_PATH!)).toBe(false);
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

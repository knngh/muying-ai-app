import fs from 'fs';
import path from 'path';
import vm from 'vm';

const { buildSync } = require('../frontend/node_modules/esbuild');
const workerPath = path.resolve(__dirname, '../frontend/worker.ts');
// Expose the renderer only inside this test bundle; production keeps its Worker API.
const compiled = buildSync({
  stdin: {
    contents: `${fs.readFileSync(workerPath, 'utf8')}\nexport { buildArticleBodyRender };`,
    resolveDir: path.dirname(workerPath),
    loader: 'ts',
  },
  bundle: true, write: false, format: 'cjs', platform: 'node',
}).outputFiles[0].text;
const workerModule = { exports: {} as {
  buildArticleBodyRender: (detail: Record<string, unknown>) => { html: string; plainText: string };
} };
vm.runInNewContext(compiled, { module: workerModule, exports: workerModule.exports, Request });

it.each([true, false])('keeps JSON-LD text identical to the selected article body (verified layout: %s)', verified => {
  const content = '<h2>疫苗成分</h2><ul><li>水</li><li>稳定剂</li></ul>';
  const layoutHtml = '<h2>疫苗成分</h2><ul><li>• 水</li><li>• 稳定剂</li></ul>';
  const result = workerModule.exports.buildArticleBodyRender({
    title: '疫苗知识', content, displayContent: content,
    readingLayout: { verified, html: layoutHtml },
  });
  const expected = verified ? '疫苗成分•水•稳定剂' : '疫苗成分水稳定剂';
  expect(result.plainText.replace(/\s+/g, '')).toBe(expected);
  expect(result.html).toContain(verified ? layoutHtml : content);
});
